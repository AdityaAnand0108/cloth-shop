package com.clothshop.catalog.web;

import com.clothshop.catalog.dto.ArticleDtos.CreateBrandRequest;
import com.clothshop.catalog.dto.ArticleDtos.CreateWholesalerRequest;
import com.clothshop.catalog.dto.ArticleDtos.LookupItem;
import com.clothshop.catalog.dto.ArticleDtos.LookupsResponse;
import com.clothshop.catalog.dto.ArticleDtos.WholesalerItem;
import com.clothshop.catalog.service.LookupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class LookupController {

    private final LookupService lookups;

    public LookupController(LookupService lookups) {
        this.lookups = lookups;
    }

    /** Everything the five dropdowns need, in one call. */
    @GetMapping("/lookups")
    public LookupsResponse lookups() {
        return lookups.all();
    }

    @PostMapping("/brands")
    @ResponseStatus(HttpStatus.CREATED)
    public LookupItem createBrand(@Valid @RequestBody CreateBrandRequest request) {
        return lookups.createBrand(request);
    }

    @PostMapping("/wholesalers")
    @ResponseStatus(HttpStatus.CREATED)
    public WholesalerItem createWholesaler(@Valid @RequestBody CreateWholesalerRequest request) {
        return lookups.createWholesaler(request);
    }
}
