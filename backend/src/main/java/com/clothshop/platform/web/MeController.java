package com.clothshop.platform.web;

import com.clothshop.platform.domain.Staff;
import com.clothshop.platform.repository.StaffRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {
    private final StaffRepository staffRepository;

    public MeController(StaffRepository staffRepository) { this.staffRepository = staffRepository; }

    @GetMapping
    public Identity identity(Authentication authentication) {
        Staff staff = staffRepository.findByAuthSubjectAndActiveTrue(authentication.getName()).orElseThrow();
        return new Identity(staff.getId(), staff.getName(), staff.getRole());
    }

    public record Identity(Long staffId, String name, String role) {}
}
