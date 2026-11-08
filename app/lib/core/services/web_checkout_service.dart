import 'package:flutter/foundation.dart';

enum CheckoutStatus { processing, credited, canceled, failed }

@immutable
class CheckoutResult {
  const CheckoutResult({required this.status, this.creditsAdded});

  final CheckoutStatus status;
  final int? creditsAdded;
}

/// Web checkout. Web only: never registered in the Android build.
abstract interface class WebCheckoutService {
  /// Requires a signed-in account. Returns the address to open.
  Future<Uri> createCheckout(String productId);

  /// Called when the user returns; waits for the credit to appear (or reports it still processing).
  Future<CheckoutResult> confirm(String checkoutId);
}
