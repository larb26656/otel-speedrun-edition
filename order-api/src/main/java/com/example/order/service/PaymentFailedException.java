package com.example.order.service;

public class PaymentFailedException extends RuntimeException {

	public PaymentFailedException(String message) {
		super(message);
	}
}
