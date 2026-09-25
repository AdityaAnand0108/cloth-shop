package com.clothshop.platform.service;

import com.clothshop.platform.repository.AppSettingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class SettingsService {

    public static final String DEFAULT_MARKUP = "pricing.default_markup";

    private final AppSettingRepository repo;

    public SettingsService(AppSettingRepository repo) {
        this.repo = repo;
    }

    /**
     * The selling-price multiplier the form pre-fills with. A setting rather than a
     * constant, so the shop can move off 2x without a code change.
     */
    @Transactional(readOnly = true)
    public BigDecimal defaultMarkup() {
        return repo.findById(DEFAULT_MARKUP)
                .map(s -> new BigDecimal(s.getValue().trim()))
                .orElse(new BigDecimal("2.0"));
    }
}
