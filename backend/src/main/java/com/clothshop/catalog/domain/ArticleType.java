package com.clothshop.catalog.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "article_type")
@Getter
@Setter
public class ArticleType extends LookupEntity {

    /** Which size list this article offers on the form. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "size_group_id", nullable = false)
    private SizeGroup sizeGroup;
}
