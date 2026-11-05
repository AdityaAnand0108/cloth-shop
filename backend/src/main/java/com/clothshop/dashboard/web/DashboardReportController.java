package com.clothshop.dashboard.web;

import com.clothshop.dashboard.dto.DashboardDtos.Report;
import com.clothshop.dashboard.service.DashboardReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardReportController {
    private final DashboardReportService reports;
    public DashboardReportController(DashboardReportService reports) { this.reports = reports; }

    @GetMapping("/report")
    public Report report(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reports.report(from, to);
    }
}
