package com.clothshop.config;

import com.clothshop.platform.domain.Staff;
import com.clothshop.platform.repository.StaffRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.RemoteJWKSet;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import java.net.URL;

import java.util.List;

@Configuration
public class NeonJwtConfig {
    @Bean
    JwtDecoder jwtDecoder(@Value("${app.auth.jwks-url}") String jwksUrl,
                          @Value("${app.auth.issuer}") String issuer) {
        try {
            DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
            processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.EdDSA,
                    new RemoteJWKSet<>(new URL(jwksUrl))));
            NimbusJwtDecoder decoder = new NimbusJwtDecoder(processor);
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
            return decoder;
        } catch (Exception exception) {
            throw new IllegalStateException("Could not configure Neon Auth JWKS verification. Check NEON_AUTH_JWKS_URL.", exception);
        }
    }

    @Bean
    Converter<Jwt, ? extends AbstractAuthenticationToken> staffJwtAuthenticationConverter(StaffRepository staffRepository) {
        return jwt -> {
            Staff staff = staffRepository.findByAuthSubjectAndActiveTrue(jwt.getSubject()).orElse(null);
            String role = staff == null ? "UNLINKED" : staff.getRole();
            List<SimpleGrantedAuthority> authorities = staff == null ? List.of()
                    : List.of(new SimpleGrantedAuthority("ROLE_" + role));
            return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
        };
    }
}
