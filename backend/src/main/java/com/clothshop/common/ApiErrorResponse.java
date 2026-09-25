package com.clothshop.common;

import java.time.Instant;
import java.util.Map;

public record ApiErrorResponse(
        String code,
        String message,
        Map<String, Object> details,
        Instant timestamp
) {
    public static ApiErrorResponse of(String code, String message, Map<String, Object> details) {
        return new ApiErrorResponse(code, message, details == null ? Map.of() : details, Instant.now());
    }
}
