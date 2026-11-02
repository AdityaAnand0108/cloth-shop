package com.clothshop.platform.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "customer")
@Getter
@Setter
public class Customer {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "normalized_phone", nullable = false, unique = true, length = 20)
    private String normalizedPhone;

    @Column(nullable = false, length = 32)
    private String phone;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "whatsapp_opt_in", nullable = false)
    private boolean whatsappOptIn;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
