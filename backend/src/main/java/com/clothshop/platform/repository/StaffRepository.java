package com.clothshop.platform.repository;

import com.clothshop.platform.domain.Staff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StaffRepository extends JpaRepository<Staff, Long> {

    List<Staff> findByActiveTrueOrderBySortOrderAsc();
}
