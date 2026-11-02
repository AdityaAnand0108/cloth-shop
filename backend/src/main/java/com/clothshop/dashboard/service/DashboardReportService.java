package com.clothshop.dashboard.service;

import com.clothshop.dashboard.dto.DashboardDtos.*;
import com.clothshop.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
public class DashboardReportService {
    private final JdbcTemplate jdbc;
    private final ZoneId shopZone;
    private final String locationCode;

    public DashboardReportService(JdbcTemplate jdbc,
                                  @Value("${app.shop.zone}") String shopZone,
                                  @Value("${app.inventory.default-location-code}") String locationCode) {
        this.jdbc = jdbc;
        this.shopZone = ZoneId.of(shopZone);
        this.locationCode = locationCode;
    }

    @Transactional(readOnly = true)
    public Report report(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now(shopZone) : to;
        LocalDate start = from == null ? end : from;
        if (start.isAfter(end)) throw ApiException.badRequest("INVALID_DATE_RANGE", "Start date must be on or before end date.");
        if (start.plusDays(366).isBefore(end)) throw ApiException.badRequest("DATE_RANGE_TOO_LARGE", "Choose a date range of one year or less.");
        Instant startAt = start.atStartOfDay(shopZone).toInstant();
        Instant endAt = end.plusDays(1).atStartOfDay(shopZone).toInstant();
        // pgJDBC maps SQL timestamps from java.sql.Timestamp. Passing Instant directly
        // through JdbcTemplate is not supported by the driver's JDBC 4.2 type mapping.
        Timestamp startTime = Timestamp.from(startAt);
        Timestamp endTime = Timestamp.from(endAt);

        Sales sales = jdbc.queryForObject("""
                select count(s.id) as bills,
                       coalesce(sum(s.total), 0) - coalesce((select sum(r.refund_amount) from sale_return r where r.created_at >= ? and r.created_at < ?), 0) as takings,
                       coalesce(sum(s.profit), 0) - coalesce((select sum(r.refund_amount) from sale_return r where r.created_at >= ? and r.created_at < ?), 0)
                         + coalesce((select sum(rl.quantity * sl.unit_cost) from sale_return r join sale_return_line rl on rl.sale_return_id=r.id join sale_line sl on sl.id=rl.original_sale_line_id where rl.restocked=true and r.created_at >= ? and r.created_at < ?), 0) as profit,
                       coalesce(sum(s.discount), 0) as discounts,
                       coalesce((select sum(sl.qty) from sale_line sl join sale sx on sx.id=sl.sale_id where sx.created_at >= ? and sx.created_at < ?), 0)
                         - coalesce((select sum(rl.quantity) from sale_return_line rl join sale_return r on r.id=rl.sale_return_id where r.created_at >= ? and r.created_at < ?), 0) as items,
                       (select count(*) from sale_return r where r.created_at >= ? and r.created_at < ?) as returns,
                       (select count(distinct sx.id) from sale sx join sale_line sl on sl.sale_id=sx.id where sx.created_at >= ? and sx.created_at < ? and sl.cost_estimated=true) as estimated
                  from sale s where s.created_at >= ? and s.created_at < ? and s.status = 'COMPLETED'
                """, (rs, row) -> new Sales(rs.getInt("bills"), rs.getInt("returns"), rs.getBigDecimal("items"),
                rs.getBigDecimal("takings"), rs.getBigDecimal("profit"), rs.getBigDecimal("discounts"), rs.getInt("estimated")),
                startTime, endTime, startTime, endTime, startTime, endTime, startTime, endTime,
                startTime, endTime, startTime, endTime, startTime, endTime, startTime, endTime);

        Inventory inventory = jdbc.queryForObject("""
                select count(v.id) as variants,
                       coalesce(sum(coalesce(st.qty_on_hand, 0)), 0) as units,
                       coalesce(sum(coalesce(st.qty_on_hand, 0) * v.avg_cost), 0) as stock_cost,
                       count(*) filter (where coalesce(st.qty_on_hand, 0) <= 0) as out_count,
                       count(*) filter (where v.reorder_level > 0 and coalesce(st.qty_on_hand, 0) <= v.reorder_level) as low_count
                  from product_variant v
                  join location l on l.code = ?
                  left join inventory_stock st on st.variant_id = v.id and st.location_id = l.id
                 where v.status = 'ACTIVE'
                """, (rs, row) -> new Inventory(rs.getInt("variants"), rs.getBigDecimal("units"),
                rs.getBigDecimal("stock_cost"), rs.getInt("out_count"), rs.getInt("low_count")), locationCode);

        List<PaymentTotal> payments = jdbc.query("""
                select mode, sum(amount) as total from (
                    select payment_mode as mode, total as amount from sale
                     where created_at >= ? and created_at < ? and status='COMPLETED'
                    union all
                    select refund_payment_mode as mode, -refund_amount as amount from sale_return
                     where created_at >= ? and created_at < ? and refund_payment_mode is not null
                ) movement group by mode order by mode
                """, (rs, row) -> new PaymentTotal(rs.getString("mode"), rs.getBigDecimal("total")),
                startTime, endTime, startTime, endTime);

        List<TopSeller> topSellers = jdbc.query("""
                select sl.variant_id, sl.article_code, sl.description, sl.colour, sl.size,
                       sum(greatest(sl.qty - coalesce(ret.quantity,0),0)) as quantity,
                       sum(greatest(sl.line_total - coalesce(ret.refund_total,0),0)) as sales
                  from sale_line sl join sale s on s.id=sl.sale_id
                  left join lateral (
                      select sum(rl.quantity) as quantity, sum(rl.refund_total) as refund_total
                        from sale_return_line rl join sale_return r on r.id=rl.sale_return_id
                       where rl.original_sale_line_id=sl.id and r.created_at >= ? and r.created_at < ?
                  ) ret on true
                 where s.created_at >= ? and s.created_at < ? and s.status='COMPLETED'
                 group by sl.variant_id, sl.article_code, sl.description, sl.colour, sl.size
                 having sum(greatest(sl.qty - coalesce(ret.quantity,0),0)) > 0
                 order by quantity desc, sales desc limit 8
                """, (rs, row) -> new TopSeller(rs.getLong("variant_id"), rs.getString("article_code"),
                rs.getString("description"), rs.getString("colour"), rs.getString("size"),
                rs.getBigDecimal("quantity"), rs.getBigDecimal("sales")), startTime, endTime, startTime, endTime);

        List<StockAlert> lowStock = jdbc.query("""
                select v.id, v.article_code, p.display_name, c.name as colour, z.name as size,
                       coalesce(st.qty_on_hand,0) as quantity, v.reorder_level
                  from product_variant v join product p on p.id=v.product_id
                  join colour c on c.id=v.colour_id join clothing_size z on z.id=v.size_id
                  join location l on l.code=?
                  left join inventory_stock st on st.variant_id=v.id and st.location_id=l.id
                 where v.status='ACTIVE' and v.reorder_level > 0 and coalesce(st.qty_on_hand,0) <= v.reorder_level
                 order by coalesce(st.qty_on_hand,0), v.article_code limit 12
                """, (rs, row) -> new StockAlert(rs.getLong("id"), rs.getString("article_code"),
                rs.getString("display_name"), rs.getString("colour"), rs.getString("size"),
                rs.getBigDecimal("quantity"), rs.getBigDecimal("reorder_level")), locationCode);

        List<SlowMover> slowMovers = jdbc.query("""
                select v.id, v.article_code, p.display_name, c.name as colour, z.name as size,
                       coalesce(st.qty_on_hand,0) as quantity,
                       coalesce(st.qty_on_hand,0) * v.avg_cost as stock_cost,
                       last_sale.last_sold_at
                  from product_variant v join product p on p.id=v.product_id
                  join colour c on c.id=v.colour_id join clothing_size z on z.id=v.size_id
                  join location l on l.code=?
                  left join inventory_stock st on st.variant_id=v.id and st.location_id=l.id
                  left join lateral (select max(created_at) as last_sold_at from stock_ledger
                                      where variant_id=v.id and movement_type='SALE_OUT') last_sale on true
                 where v.status='ACTIVE' and coalesce(st.qty_on_hand,0) > 0
                 order by last_sale.last_sold_at asc nulls first, stock_cost desc limit 8
                """, (rs, row) -> {
            Timestamp last = rs.getTimestamp("last_sold_at");
            Instant lastSold = last == null ? null : last.toInstant();
            Integer days = lastSold == null ? null : Math.toIntExact(
                    java.time.temporal.ChronoUnit.DAYS.between(lastSold.atZone(shopZone).toLocalDate(), LocalDate.now(shopZone)));
            return new SlowMover(rs.getLong("id"), rs.getString("article_code"), rs.getString("display_name"),
                    rs.getString("colour"), rs.getString("size"), rs.getBigDecimal("quantity"),
                    rs.getBigDecimal("stock_cost"), lastSold, days);
        }, locationCode);

        return new Report(start, end, sales, inventory, payments, topSellers, lowStock, slowMovers);
    }
}
