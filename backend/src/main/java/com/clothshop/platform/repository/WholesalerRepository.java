package com.clothshop.platform.repository;

import com.clothshop.platform.domain.Wholesaler;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WholesalerRepository extends JpaRepository<Wholesaler, Long> {

    List<Wholesaler> findByActiveTrueOrderByNameAsc();

    Optional<Wholesaler> findByNameIgnoreCase(String name);
}
