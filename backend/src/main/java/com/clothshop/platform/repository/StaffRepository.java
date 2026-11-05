package com.clothshop.platform.repository;

import com.clothshop.platform.domain.Staff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StaffRepository extends JpaRepository<Staff, Long> {

    List<Staff> findByActiveTrueOrderBySortOrderAsc();

    Optional<Staff> findByAuthSubjectAndActiveTrue(String authSubject);
}
