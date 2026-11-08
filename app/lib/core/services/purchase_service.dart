import 'package:flutter/foundation.dart';

import '../errors/app_error.dart';

/// A pack as the store sells it. [priceLabel] is the store's own localized price string.
@immutable
class PurchaseProduct {
  const PurchaseProduct({required this.productId, required this.credits, required this.priceLabel});

  final String productId;
  final int credits;
  final String priceLabel;
}

enum PurchaseStatus { pending, credited, canceled, failed }

/// One change in a purchase's life.
@immutable
class PurchaseUpdate {
  const PurchaseUpdate({required this.productId, required this.status, this.creditsAdded, this.error});

  final String productId;
  final PurchaseStatus status;

  /// Credits the server added once the purchase was verified.
  final int? creditsAdded;
  final AppError? error;
}

/// Google Play Billing. Android only: the web build never registers this
/// contract, and the Android build never registers the web checkout, so no code
/// path in the Play app can steer to a web purchase (blueprint Section 10).
abstract interface class PurchaseService {
  Future<List<PurchaseProduct>> products();

  /// Starts the store's payment sheet. The result arrives on [updates].
  Future<void> purchase(String productId);

  /// Re-checks purchases that were paid but not yet credited (also run at launch).
  Future<void> restore();

  Stream<PurchaseUpdate> get updates;
}
