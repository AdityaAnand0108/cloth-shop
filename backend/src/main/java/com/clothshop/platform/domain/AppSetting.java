package com.clothshop.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "app_setting")
@Getter
@Setter
public class AppSetting {

    @Id
    @Column(name = "key", length = 96)
    private String key;

    /** Stored as jsonb. Read as text and parsed by the caller — values here are scalars. */
    @Column(name = "value", nullable = false)
    private String value;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
