package com.clothshop.sales.repository;

import com.clothshop.sales.domain.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    Optional<Sale> findByBillNo(String billNo);

    /** The bill screen, with its lines in one round trip. */
    @Query("select s from Sale s left join fetch s.lines where s.id = :id")
    Optional<Sale> findWithLines(@Param("id") Long id);

    /**
     * Bills rung up in a window, newest first. Used for "what have we sold today",
     * which is the first thing anyone at the counter wants to know.
     */
    List<Sale> findByCreatedAtBetweenOrderByCreatedAtDesc(Instant from, Instant to);

    /** The next bill number. A sequence, so two tills can never mint the same one. */
    @Query(value = "select nextval('bill_no_seq')", nativeQuery = true)
    Long nextBillSequence();
}
