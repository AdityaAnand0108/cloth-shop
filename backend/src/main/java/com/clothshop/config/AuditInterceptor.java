package com.clothshop.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuditInterceptor implements HandlerInterceptor {
    private static final Logger log = LoggerFactory.getLogger(AuditInterceptor.class);
    private final JdbcTemplate jdbc;

    public AuditInterceptor(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (!request.getRequestURI().startsWith("/api/") || "GET".equals(request.getMethod())
                || "HEAD".equals(request.getMethod()) || "OPTIONS".equals(request.getMethod())) return;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) return;
        try {
            jdbc.update("insert into audit_event (auth_subject, staff_id, staff_name, role, http_method, request_path, status_code) "
                            + "select ?, id, name, role, ?, ?, ? from staff where auth_subject = ?",
                    auth.getName(), request.getMethod(), request.getRequestURI(), response.getStatus(), auth.getName());
        } catch (Exception auditFailure) {
            log.warn("Could not record API audit event for {} {}", request.getMethod(), request.getRequestURI());
        }
    }
}
