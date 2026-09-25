package com.clothshop.platform.service;

import com.clothshop.platform.domain.IdempotencyRecord;
import com.clothshop.platform.repository.IdempotencyRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Makes a double-tapped "Add this inventory" button harmless.
 * <p>
 * The client sends an {@code Idempotency-Key} it generated when the form was opened.
 * A replay of the same key returns the stored response instead of adding stock twice.
 */
@Service
public class IdempotencyService {

    private final IdempotencyRepository repo;
    private final ObjectMapper mapper;

    public IdempotencyService(IdempotencyRepository repo, ObjectMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public <T> Optional<T> replay(String key, Class<T> type) {
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }
        return repo.findById(key).map(rec -> {
            try {
                return mapper.readValue(rec.getResponseBody(), type);
            } catch (Exception e) {
                return null;
            }
        });
    }

    /** Runs in its own transaction so recording the key never rolls back the work itself. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void remember(String key, String endpoint, Object response) {
        if (key == null || key.isBlank() || repo.existsById(key)) {
            return;
        }
        try {
            IdempotencyRecord rec = new IdempotencyRecord();
            rec.setKey(key);
            rec.setEndpoint(endpoint);
            rec.setStatusCode(200);
            rec.setResponseBody(mapper.writeValueAsString(response));
            repo.save(rec);
        } catch (Exception ignored) {
            // Never fail the caller's request because bookkeeping failed.
        }
    }
}
