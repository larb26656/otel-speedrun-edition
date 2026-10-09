package com.example.order.service;

import com.example.order.client.HelloApiClient;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;

import java.util.Map;

@Service
public class OrderService {

	private static final Logger log = LoggerFactory.getLogger(OrderService.class);

	private final HelloApiClient helloApi;

	private final ObservationRegistry observations;

	public OrderService(HelloApiClient helloApi, ObservationRegistry observations) {
		this.helloApi = helloApi;
		this.observations = observations;
	}

	public Map<String, Object> greetUser(String name) {
		return Observation.createNotStarted("order.greet-user", observations)
			.observe(() -> {
				log.info("greeting user via hello-api: {}", name);
				return Map.of("greeting", helloApi.greet(name));
			});
	}

	public Map<String, Object> getOrder(long id, long ms) {
		return Observation.createNotStarted("order.hydrate", observations)
			.observe(() -> {
				log.info("fetching order {} (hydrating via hello-api, ms={})", id, ms);
				Map<String, Object> slowResult = helloApi.slow(ms);
				return Map.of("orderId", id, "status", "hydrated", "slow", slowResult);
			});
	}

	public Map<String, Object> checkout(int p, int maxMs) {
		return Observation.createNotStarted("order.checkout", observations)
			.lowCardinalityKeyValue("payment.fail_rate", p + "%")
			.observe(() -> {
				log.info("checkout started (charging payment via hello-api p={} maxMs={})", p, maxMs);
				try {
					Map<String, Object> payment = helloApi.chaos(p, maxMs);
					log.info("payment completed: {}", payment);
					return Map.of("status", "completed", "payment", payment);
				}
				catch (HttpStatusCodeException e) {
					log.error("payment failed with status {}: {}", e.getStatusCode(),
							e.getResponseBodyAsString());
					throw new PaymentFailedException(
							"payment gateway failed with " + e.getStatusCode());
				}
			});
	}
}
