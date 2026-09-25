package com.clothshop.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** One row per completed mutating request, so a replay returns the original answer. */
@Entity
@Table(name = "idempotency_record")
@Getter
@Setter
public class IdempotencyRecord {

    @Id
    @Column(name = "key", length = 80)
    private String key;

    @Column(nullable = false, length = 120)
    private String endpoint;

    @Column(name = "status_code", nullable = false)
    private int statusCode;

    @Column(name = "response_body", nullable = false)
    private String responseBody;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
