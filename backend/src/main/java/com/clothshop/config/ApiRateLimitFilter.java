package com.clothshop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Small per-instance guardrail; shared deployments should use a distributed limiter. */
public class ApiRateLimitFilter extends OncePerRequestFilter {
    private record Window(long minute, AtomicInteger count) {}
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                              FilterChain chain) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !request.getRequestURI().startsWith("/api/")) {
            chain.doFilter(request, response); return;
        }
        long minute = Instant.now().getEpochSecond() / 60;
        String key = auth.getName() + ':' + ("GET".equals(request.getMethod()) ? "read" : "write");
        int limit = "GET".equals(request.getMethod()) ? 120 : 30;
        Window window = windows.compute(key, (ignored, previous) -> previous == null || previous.minute() != minute
                ? new Window(minute, new AtomicInteger()) : previous);
        if (window.count().incrementAndGet() > limit) {
            response.setStatus(429); response.setContentType("application/json");
            response.setHeader("Retry-After", String.valueOf(60 - Instant.now().getEpochSecond() % 60));
            mapper.writeValue(response.getOutputStream(), Map.of("code", "RATE_LIMITED", "message", "Too many requests. Try again shortly.", "details", Map.of()));
            return;
        }
        chain.doFilter(request, response);
    }
}
