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
                // Use the algorithm published by the matching signing key in JWKS. Neon Auth
                // signing algorithms can vary across deployments and key rotations, so pinning
                // this selector to EdDSA/ES256 can reject otherwise valid access tokens.
                JWKSource<SecurityContext> jwkSource = JWKSourceBuilder
                                .<SecurityContext>create(URI.create(jwksUrl).toURL())
                                .build();

                JWSVerificationKeySelector<SecurityContext> keySelector = new JWSVerificationKeySelector<>(
                                JWSAlgorithm.Family.SIGNATURE, jwkSource);

                ConfigurableJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<>();
                jwtProcessor.setJWSKeySelector(keySelector);

                NimbusJwtDecoder decoder = new NimbusJwtDecoder(jwtProcessor);
                OAuth2TokenValidator<Jwt> validator = JwtValidators.createDefaultWithIssuer(neonAuthIssuer(issuer));
                decoder.setJwtValidator(validator);
                return decoder;
        }

        /** Neon Auth's branch URL is the issuer; accept the project host as a convenience too. */
        private static String neonAuthIssuer(String configuredBaseUrl) {
                String baseUrl = configuredBaseUrl.replaceAll("/+$", "");
                URI uri = URI.create(baseUrl);
                String path = uri.getPath();
                if (path == null || path.isEmpty() || "/".equals(path)) {
                        return baseUrl + "/neondb/auth";
                }
                return baseUrl;
        }
}
