package com.clothshop.config;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

import java.net.URI;

/** Protect the shop API with access tokens issued by Neon Auth. */
@Configuration
public class SecurityConfig {

        @Bean
        SecurityFilterChain apiSecurity(HttpSecurity http,
                        @Value("${app.security.enabled:false}") boolean enabled) throws Exception {
                http.csrf(csrf -> csrf.disable())
                                .cors(Customizer.withDefaults())
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS));

                if (enabled) {
                        http.authorizeHttpRequests(auth -> auth
                                        .requestMatchers("/health", "/swagger-ui.html", "/swagger-ui/**",
                                                        "/v3/api-docs/**")
                                        .permitAll()
                                        .anyRequest().authenticated())
                                        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
                } else {
                        // Keep local development friction-free; production enables Neon JWT validation.
                        http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
                }
                return http.build();
        }

        @Bean
        @ConditionalOnProperty(name = "app.security.enabled", havingValue = "true")
        JwtDecoder neonAuthJwtDecoder(@Value("${NEON_AUTH_JWKS_URL}") String jwksUrl,
                        @Value("${NEON_AUTH_BASE_URL}") String issuer) throws Exception {
                // Build a single JWK source from Neon's JWKS endpoint and pin it to ES256
                // (the algorithm Neon Auth uses). Avoid NimbusJwtDecoder.withJwkSetUri()
                // because
                // it creates a second competing internal JWK source that causes the decoder to
                // never find the right key, resulting in a 401 "no matching key(s) found"
                // error.
                JWKSource<SecurityContext> jwkSource = JWKSourceBuilder
                                .<SecurityContext>create(URI.create(jwksUrl).toURL())
                                .build();

                JWSVerificationKeySelector<SecurityContext> keySelector = new JWSVerificationKeySelector<>(
                                JWSAlgorithm.ES256, jwkSource);

                ConfigurableJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<>();
                jwtProcessor.setJWSKeySelector(keySelector);

                NimbusJwtDecoder decoder = new NimbusJwtDecoder(jwtProcessor);
                OAuth2TokenValidator<Jwt> validator = JwtValidators.createDefaultWithIssuer(issuer);
                decoder.setJwtValidator(validator);
                return decoder;
        }
}
