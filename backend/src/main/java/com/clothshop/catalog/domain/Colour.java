package com.clothshop.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "colour")
@Getter
@Setter
public class Colour extends LookupEntity {

    /** Shown as a swatch in the dropdown so staff pick by eye, not by reading. */
    @Column(length = 7)
    private String hex;
}
