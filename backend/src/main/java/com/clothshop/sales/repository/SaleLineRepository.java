package com.clothshop.sales.repository;

import com.clothshop.sales.domain.SaleLine;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleLineRepository extends JpaRepository<SaleLine, Long> {
}
