package com.clothshop.platform.web;

import com.clothshop.platform.dto.CustomerDtos.CustomerSummary;
import com.clothshop.platform.service.CustomerService;
import com.clothshop.sales.dto.SaleDtos.BillSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/customers")
public class CustomerController {
    private final CustomerService customers;
    public CustomerController(CustomerService customers) { this.customers = customers; }

    @GetMapping
    public List<CustomerSummary> search(@RequestParam String q) { return customers.search(q); }

    @GetMapping("/{id}/bills")
    public List<BillSummary> history(@org.springframework.web.bind.annotation.PathVariable Long id) {
        return customers.history(id);
    }
}
