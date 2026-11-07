import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

/// The user's referral standing (blueprint Section 53).
@immutable
class ReferralState {
  const ReferralState({
    this.code,
    this.referredCount = 0,
    this.pendingCredits = 0,
    this.settledCredits = 0,
    this.appliedCode,
  });

  /// Reads `GET /referral`.
  factory ReferralState.fromJson(Map<String, dynamic> json) => ReferralState(
        code: readStringOrNull(json['code']),
        referredCount: readInt(json['referred_count']),
        pendingCredits: readInt(json['pending_credits']),
        settledCredits: readInt(json['settled_credits']),
        appliedCode: readStringOrNull(json['applied_code']),
      );

  /// This account's own code to share.
  final String? code;
  final int referredCount;

  /// Bonus credits still inside the hold period.
  final int pendingCredits;

  /// Bonus credits already added to the wallet.
  final int settledCredits;

  /// The code this account used when it signed up, if any.
  final String? appliedCode;

  ReferralState copyWith({
    String? code,
    int? referredCount,
    int? pendingCredits,
    int? settledCredits,
    String? appliedCode,
  }) =>
      ReferralState(
        code: code ?? this.code,
        referredCount: referredCount ?? this.referredCount,
        pendingCredits: pendingCredits ?? this.pendingCredits,
        settledCredits: settledCredits ?? this.settledCredits,
        appliedCode: appliedCode ?? this.appliedCode,
      );

  @override
  bool operator ==(Object other) =>
      other is ReferralState &&
      other.code == code &&
      other.referredCount == referredCount &&
      other.pendingCredits == pendingCredits &&
      other.settledCredits == settledCredits &&
      other.appliedCode == appliedCode;

  @override
  int get hashCode => Object.hash(code, referredCount, pendingCredits, settledCredits, appliedCode);
}
