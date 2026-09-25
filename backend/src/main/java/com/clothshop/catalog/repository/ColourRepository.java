package com.clothshop.catalog.repository;

import com.clothshop.catalog.domain.Colour;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ColourRepository extends JpaRepository<Colour, Long> {
    List<Colour> findByActiveTrueOrderBySortOrderAsc();
    Optional<Colour> findByCode(String code);
}
