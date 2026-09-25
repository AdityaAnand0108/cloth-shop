package com.clothshop.catalog.service;

import com.clothshop.catalog.domain.Brand;
import com.clothshop.catalog.dto.ArticleDtos.CreateBrandRequest;
import com.clothshop.catalog.dto.ArticleDtos.CreateWholesalerRequest;
import com.clothshop.catalog.dto.ArticleDtos.LookupItem;
import com.clothshop.catalog.dto.ArticleDtos.LookupsResponse;
import com.clothshop.catalog.dto.ArticleDtos.StaffItem;
import com.clothshop.catalog.dto.ArticleDtos.WholesalerItem;
import com.clothshop.catalog.repository.*;
import com.clothshop.common.ApiException;
import com.clothshop.platform.domain.Wholesaler;
import com.clothshop.platform.repository.StaffRepository;
import com.clothshop.platform.repository.WholesalerRepository;
import com.clothshop.platform.service.SettingsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class LookupService {

    private final ArticleTypeRepository articleTypes;
    private final MaterialRepository materials;
    private final ColourRepository colours;
    private final ClothingSizeRepository sizes;
    private final BrandRepository brands;
    private final WholesalerRepository wholesalers;
    private final StaffRepository staff;
    private final SettingsService settings;

    public LookupService(ArticleTypeRepository articleTypes, MaterialRepository materials,
                         ColourRepository colours, ClothingSizeRepository sizes,
                         BrandRepository brands, WholesalerRepository wholesalers,
                         StaffRepository staff, SettingsService settings) {
        this.articleTypes = articleTypes;
        this.materials = materials;
        this.colours = colours;
        this.sizes = sizes;
        this.brands = brands;
        this.wholesalers = wholesalers;
        this.staff = staff;
        this.settings = settings;
    }

    /** Everything the form needs, in one call. The client caches it. */
    @Transactional(readOnly = true)
    public LookupsResponse all() {
        return new LookupsResponse(
                articleTypes.findByActiveTrueOrderBySortOrderAsc().stream()
                        .map(a -> new LookupItem(a.getId(), a.getCode(), a.getName(), null,
                                a.getSizeGroup().getId()))
                        .toList(),
                materials.findByActiveTrueOrderBySortOrderAsc().stream()
                        .map(m -> new LookupItem(m.getId(), m.getCode(), m.getName(), null, null))
                        .toList(),
                colours.findByActiveTrueOrderBySortOrderAsc().stream()
                        .map(c -> new LookupItem(c.getId(), c.getCode(), c.getName(), c.getHex(), null))
                        .toList(),
                sizes.findByActiveTrueOrderBySizeGroupIdAscSortOrderAsc().stream()
                        .map(s -> new LookupItem(s.getId(), s.getCode(), s.getName(), null,
                                s.getSizeGroup().getId()))
                        .toList(),
                brands.findByActiveTrueOrderByNameAsc().stream()
                        .map(b -> new LookupItem(b.getId(), b.getCode(), b.getName(), null, null))
                        .toList(),
                wholesalers.findByActiveTrueOrderByNameAsc().stream()
                        .map(w -> new WholesalerItem(w.getId(), w.getName(), w.getPhone(), w.getAddress()))
                        .toList(),
                staff.findByActiveTrueOrderBySortOrderAsc().stream()
                        .map(s -> new StaffItem(s.getId(), s.getName()))
                        .toList(),
                settings.defaultMarkup());
    }

    /**
     * Wholesalers are open-ended like brands, so staff add them mid-entry rather than
     * abandoning the form. Name, phone and address are all required — a supplier you
     * cannot ring up is not much of a record.
     */
    @Transactional
    public WholesalerItem createWholesaler(CreateWholesalerRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String phone = request.phone() == null ? "" : request.phone().trim();
        String address = request.address() == null ? "" : request.address().trim();

        if (name.length() < 2) {
            throw ApiException.badRequest("WHOLESALER_NAME_TOO_SHORT",
                    "Wholesaler name needs at least 2 characters");
        }
        if (phone.isBlank()) {
            throw ApiException.badRequest("WHOLESALER_PHONE_REQUIRED", "A contact number is required");
        }
        if (address.isBlank()) {
            throw ApiException.badRequest("WHOLESALER_ADDRESS_REQUIRED", "An address is required");
        }

        wholesalers.findByNameIgnoreCase(name).ifPresent(existing -> {
            throw ApiException.conflict("WHOLESALER_EXISTS",
                    name + " is already on the list.",
                    Map.of("id", existing.getId(), "phone", existing.getPhone()));
        });

        Wholesaler wholesaler = new Wholesaler();
        wholesaler.setName(name);
        wholesaler.setPhone(phone);
        wholesaler.setAddress(address);
        wholesaler.setActive(true);
        wholesalers.save(wholesaler);

        return new WholesalerItem(wholesaler.getId(), wholesaler.getName(),
                wholesaler.getPhone(), wholesaler.getAddress());
    }

    /**
     * Brands are open-ended, so staff create them. The 2-letter code is suggested from
     * the name and then checked — if it is taken, the caller must choose another rather
     * than silently sharing a code with a different brand.
     */
    @Transactional
    public LookupItem createBrand(CreateBrandRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.length() < 2) {
            throw ApiException.badRequest("BRAND_NAME_TOO_SHORT", "Brand name needs at least 2 characters");
        }

        brands.findByNameIgnoreCase(name).ifPresent(existing -> {
            throw ApiException.conflict("BRAND_EXISTS",
                    name + " already exists with code " + existing.getCode(),
                    Map.of("id", existing.getId(), "code", existing.getCode()));
        });

        String code = (request.code() == null || request.code().isBlank())
                ? suggestCode(name)
                : request.code().trim().toUpperCase(Locale.ROOT);

        if (!code.matches("^[A-Z]{2}$")) {
            throw ApiException.badRequest("BAD_BRAND_CODE", "Brand code must be exactly 2 letters A-Z");
        }
        if (brands.existsByCode(code)) {
            Brand clash = brands.findByCode(code).orElseThrow();
            throw ApiException.conflict("BRAND_CODE_TAKEN",
                    "Code " + code + " is already used by " + clash.getName() + ". Pick another.",
                    Map.of("code", code, "usedBy", clash.getName(), "suggestions", alternatives(name)));
        }

        Brand brand = new Brand();
        brand.setName(name);
        brand.setCode(code);
        brand.setActive(true);
        brands.save(brand);

        return new LookupItem(brand.getId(), brand.getCode(), brand.getName(), null, null);
    }

    private String suggestCode(String name) {
        String letters = name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "");
        if (letters.length() < 2) {
            return "XX";
        }
        String first = letters.substring(0, 2);
        if (!brands.existsByCode(first)) {
            return first;
        }
        for (String candidate : alternatives(name)) {
            if (!brands.existsByCode(candidate)) {
                return candidate;
            }
        }
        return first;
    }

    /** First letter paired with each later letter: LEVIS -> LE, LV, LI, LS. */
    private List<String> alternatives(String name) {
        String letters = name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "");
        if (letters.length() < 2) {
            return List.of();
        }
        char head = letters.charAt(0);
        return letters.substring(1).chars()
                .mapToObj(c -> "" + head + (char) c)
                .distinct()
                .filter(c -> !brands.existsByCode(c))
                .limit(4)
                .toList();
    }
}
