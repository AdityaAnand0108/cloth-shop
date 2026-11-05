package com.clothshop.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI shopOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("BFlex Shop API")
                        .version("v1")
                        .description("Public inventory, checkout, and store overview endpoints for the BFlex shop."));
    }
}
