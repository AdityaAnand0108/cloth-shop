package com.clothshop.sales.repository;

import com.clothshop.sales.domain.SaleReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SaleReturnRepository extends JpaRepository<SaleReturn, Long> {
    @Query(value = "select nextval('return_no_seq')", nativeQuery = true)
    Long nextReturnSequence();
}
