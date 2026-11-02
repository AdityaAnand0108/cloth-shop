package com.clothshop.platform.service;

import com.clothshop.platform.domain.Customer;
import com.clothshop.platform.dto.CustomerDtos.CustomerSummary;
import com.clothshop.platform.repository.CustomerRepository;
import com.clothshop.sales.dto.SaleDtos.BillSummary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CustomerService {
    private final CustomerRepository customers;
    private final JdbcTemplate jdbc;

    public CustomerService(CustomerRepository customers, JdbcTemplate jdbc) {
        this.customers = customers;
        this.jdbc = jdbc;
    }

    @Transactional
    public Customer findOrCreate(String phone, String name, Boolean whatsappOptIn) {
        String normalized = normalize(phone);
        if (normalized == null) return null;
        Customer customer = customers.findByNormalizedPhone(normalized).orElseGet(() -> {
            Customer fresh = new Customer();
            fresh.setNormalizedPhone(normalized);
            fresh.setPhone(phone.trim());
            fresh.setName(blank(name) ? "Customer" : name.trim());
            return fresh;
        });
        customer.setPhone(phone.trim());
        if (!blank(name)) customer.setName(name.trim());
        if (whatsappOptIn != null) customer.setWhatsappOptIn(whatsappOptIn);
        return customers.save(customer);
    }

    @Transactional(readOnly = true)
    public List<CustomerSummary> search(String query) {
        if (query == null || query.isBlank()) return List.of();
        String trimmed = query.trim();
        String phone = normalize(trimmed);
        String like = "%" + trimmed.toLowerCase() + "%";
        String digits = trimmed.replaceAll("\\D", "");
        String phoneLike = digits.isEmpty() ? "!no-phone-match!" : "%" + (phone == null ? digits : phone) + "%";
        return jdbc.query("""
                select c.id, c.name, c.phone, c.whatsapp_opt_in,
                       count(s.id) as visits,
                       coalesce(sum(s.total),0) - coalesce((select sum(r.refund_amount)
                         from sale_return r join sale rs on rs.id=r.original_sale_id
                        where rs.customer_id=c.id),0) as spend,
                       max(s.created_at) as last_visit
                  from customer c left join sale s on s.customer_id=c.id and s.status='COMPLETED'
                 where lower(c.name) like ? or c.normalized_phone like ?
                 group by c.id, c.name, c.phone, c.whatsapp_opt_in
                 order by last_visit desc nulls last, c.name asc limit 12
                """, (rs, row) -> {
            var visit = rs.getTimestamp("last_visit");
            return new CustomerSummary(rs.getLong("id"), rs.getString("name"), rs.getString("phone"),
                    rs.getInt("visits"), rs.getBigDecimal("spend"), visit == null ? null : visit.toInstant(),
                    rs.getBoolean("whatsapp_opt_in"));
        }, like, phoneLike);
    }

    @Transactional(readOnly = true)
    public List<BillSummary> history(Long customerId) {
        return jdbc.query("""
                select s.id, s.bill_no, s.created_at, s.customer_name, s.created_by,
                       coalesce(sum(sl.qty),0) as item_count, s.total, s.profit,
                       s.payment_mode, coalesce(bool_or(sl.cost_estimated), false) as profit_estimated
                  from sale s left join sale_line sl on sl.sale_id=s.id
                 where s.customer_id=? and s.status='COMPLETED'
                 group by s.id, s.bill_no, s.created_at, s.customer_name, s.created_by,
                          s.total, s.profit, s.payment_mode
                 order by s.created_at desc limit 20
                """, (rs, row) -> new BillSummary(rs.getLong("id"), rs.getString("bill_no"),
                rs.getTimestamp("created_at").toInstant(), rs.getString("customer_name"),
                rs.getString("created_by"), rs.getBigDecimal("item_count"), rs.getBigDecimal("total"),
                rs.getBigDecimal("profit"), rs.getString("payment_mode"), rs.getBoolean("profit_estimated")), customerId);
    }

    public static String normalize(String phone) {
        if (blank(phone)) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() == 10) return "91" + digits;
        if (digits.length() == 11 && digits.startsWith("0")) return "91" + digits.substring(1);
        return digits.length() >= 10 && digits.length() <= 15 ? digits : null;
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
