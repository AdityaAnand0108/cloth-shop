package com.clothshop.catalog.repository;

import com.clothshop.catalog.domain.ArticleType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ArticleTypeRepository extends JpaRepository<ArticleType, Long> {
    List<ArticleType> findByActiveTrueOrderBySortOrderAsc();
    Optional<ArticleType> findByCode(String code);
}
