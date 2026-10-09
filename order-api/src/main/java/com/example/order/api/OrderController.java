package com.example.order.api;

import com.example.order.service.OrderService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class OrderController {

	private final OrderService orderService;

	public OrderController(OrderService orderService) {
		this.orderService = orderService;
	}

	@GetMapping("/")
	public Map<String, String> home() {
		return Map.of("service", "order-api", "framework", "spring-boot");
	}

	@GetMapping("/greet/{name}")
	public Map<String, Object> greet(@PathVariable String name) {
		return orderService.greetUser(name);
	}

	@GetMapping("/orders/{id}")
	public Map<String, Object> order(@PathVariable long id, @RequestParam(defaultValue = "300") long ms) {
		return orderService.getOrder(id, clamp(ms, 1, 10_000));
	}

	@PostMapping("/checkout")
	public Map<String, Object> checkout(@RequestParam(defaultValue = "30") int p,
			@RequestParam(defaultValue = "800") int maxMs) {
		return orderService.checkout(clamp(p, 0, 100), clamp(maxMs, 1, 10_000));
	}

	private static long clamp(long value, long min, long max) {
		return Math.min(Math.max(value, min), max);
	}

	private static int clamp(int value, int min, int max) {
		return Math.min(Math.max(value, min), max);
	}
}
