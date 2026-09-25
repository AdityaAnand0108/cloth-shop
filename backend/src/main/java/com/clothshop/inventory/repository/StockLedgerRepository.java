package com.clothshop.inventory.repository;

import com.clothshop.inventory.domain.StockLedger;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockLedgerRepository extends JpaRepository<StockLedger, Long> {
    List<StockLedger> findByVariantIdOrderByCreatedAtDesc(Long variantId);
}
