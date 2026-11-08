import '../models/referral_state.dart';

/// Referral codes and standing (`GET /referral`, `POST /referral/apply`).
abstract interface class ReferralService {
  Future<ReferralState> summary();

  /// Only a new account that has made no purchase can apply a code.
  Future<void> apply(String code);

  /// The neutral share text. It never links to a purchase page.
  Future<String> shareText();
}
