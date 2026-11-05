package com.clothshop.sales.repository;

import com.clothshop.sales.domain.SaleReturnLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface SaleReturnLineRepository extends JpaRepository<SaleReturnLine, Long> {
    @Query("select coalesce(sum(r.quantity), 0) from SaleReturnLine r where r.originalSaleLineId = :saleLineId")
    BigDecimal returnedQuantity(@Param("saleLineId") Long saleLineId);
}
