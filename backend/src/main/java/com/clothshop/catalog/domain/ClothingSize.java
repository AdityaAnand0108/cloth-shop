package com.clothshop.catalog.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "clothing_size")
@Getter
@Setter
public class ClothingSize {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "size_group_id", nullable = false)
    private SizeGroup sizeGroup;

    @Column(nullable = false, length = 4)
    private String code;

    @Column(nullable = false)
    private String name;

    /** Display order. S,M,L,XL,XXL — not alphabetical. */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;
}
