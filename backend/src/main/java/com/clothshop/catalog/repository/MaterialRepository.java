package com.clothshop.catalog.repository;

import com.clothshop.catalog.domain.Material;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MaterialRepository extends JpaRepository<Material, Long> {
    List<Material> findByActiveTrueOrderBySortOrderAsc();
    Optional<Material> findByCode(String code);
}
