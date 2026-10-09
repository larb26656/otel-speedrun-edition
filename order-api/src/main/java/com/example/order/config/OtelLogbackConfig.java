package com.example.order.config;

import ch.qos.logback.classic.LoggerContext;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.instrumentation.logback.appender.v1_0.OpenTelemetryAppender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OtelLogbackConfig {

	@Bean
	ApplicationRunner otelLogbackAppenderWire(OpenTelemetry openTelemetry) {
		return args -> {
			LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
			OpenTelemetryAppender appender = (OpenTelemetryAppender) context.getLogger(Logger.ROOT_LOGGER_NAME)
				.getAppender("OTEL");
			if (appender != null) {
				appender.setOpenTelemetry(openTelemetry);
			}
		};
	}
}
