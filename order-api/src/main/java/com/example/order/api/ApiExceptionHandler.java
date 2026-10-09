package com.example.order.api;

import com.example.order.service.PaymentFailedException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(PaymentFailedException.class)
	ResponseEntity<Map<String, Object>> paymentFailed(PaymentFailedException e) {
		return ResponseEntity.status(502).body(Map.of("error", e.getMessage()));
	}
}
