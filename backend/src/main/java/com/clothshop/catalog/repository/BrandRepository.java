package com.clothshop.catalog.repository;

import com.clothshop.catalog.domain.Brand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BrandRepository extends JpaRepository<Brand, Long> {
    List<Brand> findByActiveTrueOrderByNameAsc();
    Optional<Brand> findByCode(String code);
    Optional<Brand> findByNameIgnoreCase(String name);
    boolean existsByCode(String code);
}
