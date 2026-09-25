package com.clothshop.catalog.repository;

import com.clothshop.catalog.domain.ClothingSize;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClothingSizeRepository extends JpaRepository<ClothingSize, Long> {
    List<ClothingSize> findByActiveTrueOrderBySizeGroupIdAscSortOrderAsc();
}
