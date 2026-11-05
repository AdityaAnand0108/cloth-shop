package com.clothshop.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;

/** Stateless API authentication using Neon Auth JWTs. */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http,
            Converter<Jwt, ? extends AbstractAuthenticationToken> staffJwtAuthenticationConverter) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/health", "/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/brands", "/api/v1/wholesalers",
                                "/api/v1/sales/import-batch")
                        .hasRole("OWNER")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/articles/*/reorder-level")
                        .hasRole("OWNER")
                        .requestMatchers("/api/**").hasAnyRole("OWNER", "CASHIER")
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt
                        .jwtAuthenticationConverter(staffJwtAuthenticationConverter)))
                .addFilterAfter(new ApiRateLimitFilter(), BearerTokenAuthenticationFilter.class);
        return http.build();
    }
}
