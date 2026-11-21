package com.clothshop.sales.repository;

import com.clothshop.sales.domain.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

import java.time.Instant;
import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    @Query("""
            select s from Sale s
             where s.status = 'COMPLETED'
               and (:q = '' or lower(s.billNo) like lower(concat('%', :q, '%'))
                    or lower(coalesce(s.customerName, '')) like lower(concat('%', :q, '%')))
             order by s.createdAt desc
            """)
    Page<Sale> searchCompleted(@Param("q") String q, Pageable pageable);

    Optional<Sale> findByBillNo(String billNo);
    List<Sale> findByBillNoIn(Collection<String> billNumbers);

    /** The bill screen, with its lines in one round trip. */
    @Query("select s from Sale s left join fetch s.lines where s.id = :id")
    Optional<Sale> findWithLines(@Param("id") Long id);

    /** Serialize returns for one bill so concurrent staff cannot return the same units twice. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Sale s where s.id = :id")
    Optional<Sale> lockById(@Param("id") Long id);

    /**
     * Bills rung up in a window, newest first. Used for "what have we sold today",
     * which is the first thing anyone at the counter wants to know.
     */
    List<Sale> findByCreatedAtBetweenOrderByCreatedAtDesc(Instant from, Instant to);

    /** The next bill number. A sequence, so two tills can never mint the same one. */
    @Query(value = "select nextval('bill_no_seq')", nativeQuery = true)
    Long nextBillSequence();
}
