package com.clothshop.catalog.service;

import com.clothshop.catalog.domain.ArticleType;
import com.clothshop.catalog.domain.Brand;
import com.clothshop.catalog.domain.ClothingSize;
import com.clothshop.catalog.domain.Colour;
import com.clothshop.catalog.domain.Material;
import com.clothshop.common.ApiException;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Builds the article code: article + brand + material + colour + size.
 * <pre>
 *   T-Shirt  Levis  Cotton  Black  M
 *     TS  +   LV  +   CT  +  BL  + M   =  TSLVCTBLM
 * </pre>
 *
 * Each fragment is read from the lookup row's own {@code code} column, which is
 * UNIQUE in the database. It is never derived from the name at runtime — doing
 * that collides immediately (BLACK and BLUE both give "BL", LEVIS and LEE both
 * give "LE", COTTON and CORDUROY both give "CO").
 *
 * <p>Called exactly once per variant, at creation. The result is stored and
 * frozen. It is never recomputed, because renaming a brand must not silently
 * change a code that is already printed on tags hanging in the shop.
 */
@Component
public class ArticleCodeGenerator {

    public String generate(ArticleType articleType, Brand brand, Material material,
                           Colour colour, ClothingSize size) {

        String code = fragment(articleType.getCode(), "article type")
                    + fragment(brand.getCode(), "brand")
                    + fragment(material.getCode(), "material")
                    + fragment(colour.getCode(), "colour")
                    + fragment(size.getCode(), "size");

        return code.toUpperCase(Locale.ROOT);
    }

    /** Guards against a lookup row that somehow has a blank code. */
    private String fragment(String value, String what) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest("MISSING_CODE_FRAGMENT",
                    "The selected " + what + " has no code assigned. Set one before adding articles.");
        }
        return value.trim();
    }
}
