package com.clothshop.inventory.repository;

import com.clothshop.inventory.domain.InventoryStock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryStockRepository extends JpaRepository<InventoryStock, Long> {
    Optional<InventoryStock> findByVariantIdAndLocationId(Long variantId, Long locationId);
    List<InventoryStock> findByVariantIdIn(List<Long> variantIds);
}
