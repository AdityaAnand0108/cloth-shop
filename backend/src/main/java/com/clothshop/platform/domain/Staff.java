package com.clothshop.platform.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Whoever is entering stock. Their name is what lands in {@code stock_ledger.created_by}. */
@Entity
@Table(name = "staff")
@Getter
@Setter
public class Staff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;
}
