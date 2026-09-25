package com.clothshop.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/**
 * Shared shape of every dropdown table.
 * <p>
 * {@code code} is the 2-character fragment this row contributes to an article code.
 * It is assigned by a human and unique in the database — never derived from {@code name},
 * because "first two letters" collides (BLACK/BLUE, LEVIS/LEE, COTTON/CORDUROY).
 */
@MappedSuperclass
@Getter
@Setter
public abstract class LookupEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 2)
    private String code;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;
}
