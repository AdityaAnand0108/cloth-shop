package com.clothshop.catalog.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "material")
public class Material extends LookupEntity {
}
