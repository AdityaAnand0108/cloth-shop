package com.clothshop.catalog.repository;

import com.clothshop.catalog.domain.ProductVariant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    Optional<ProductVariant> findByArticleCode(String articleCode);

    @Query("""
            select v from ProductVariant v
              join fetch v.product p
              join fetch p.articleType
              join fetch p.brand
              join fetch p.material
              join fetch v.colour
              join fetch v.size
            where upper(v.articleCode) like upper(concat(:q, '%'))
               or upper(p.displayName)  like upper(concat('%', :q, '%'))
            """)
    Page<ProductVariant> search(@Param("q") String q, Pageable pageable);
}
