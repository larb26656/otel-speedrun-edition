package com.example.order.client;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class HelloApiClient {

	private final RestClient restClient;

	public HelloApiClient(RestClient.Builder builder, @Value("${hello-api.base-url}") String baseUrl) {
		this.restClient = builder.baseUrl(baseUrl).build();
	}

	public String greet(String name) {
		return restClient.get().uri("/greet/{name}", name).retrieve().body(String.class);
	}

	@SuppressWarnings("unchecked")
	public Map<String, Object> slow(long ms) {
		return restClient.get()
			.uri(builder -> builder.path("/slow").queryParam("ms", ms).build())
			.retrieve()
			.body(Map.class);
	}

	@SuppressWarnings("unchecked")
	public Map<String, Object> chaos(int p, int maxMs) {
		return restClient.get()
			.uri(builder -> builder.path("/chaos").queryParam("p", p).queryParam("maxMs", maxMs).build())
			.retrieve()
			.body(Map.class);
	}
}
