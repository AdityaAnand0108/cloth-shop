package com.clothshop.catalog.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Letter sizes for tops, waist sizes for jeans. A jean has no size M. */
@Entity
@Table(name = "size_group")
@Getter
@Setter
public class SizeGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 16)
    private String code;

    @Column(nullable = false)
    private String name;
}
