package com.clothshop.platform.service;

import com.clothshop.common.ApiException;
import com.clothshop.platform.domain.Staff;
import com.clothshop.platform.repository.StaffRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class StaffAccessService {
    private final StaffRepository staffRepository;
    public StaffAccessService(StaffRepository staffRepository) { this.staffRepository = staffRepository; }

    public Staff requireActor(Long requestedStaffId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) throw ApiException.forbidden("STAFF_REQUIRED", "Staff identity is required");
        Staff actor = staffRepository.findByAuthSubjectAndActiveTrue(auth.getName())
                .orElseThrow(() -> ApiException.forbidden("STAFF_REQUIRED", "Active staff identity is required"));
        if (!"OWNER".equals(actor.getRole()) && !actor.getId().equals(requestedStaffId)) {
            throw ApiException.forbidden("STAFF_MISMATCH", "You can only record actions under your own staff account");
        }
        return "OWNER".equals(actor.getRole()) && requestedStaffId != null
                ? staffRepository.findById(requestedStaffId).orElseThrow(() -> ApiException.notFound("Staff member"))
                : actor;
    }
}
