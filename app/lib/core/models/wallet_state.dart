import 'package:flutter/foundation.dart';

import '../errors/app_error.dart';
import 'json_helpers.dart';

/// The wallet as the app shows it. Part IX of the blueprint removed devices and
/// recovery codes from this model: the account screen owns those.
@immutable
class WalletState {
  const WalletState({
    required this.balance,
    this.owed = 0,
    this.everPurchased = false,
    this.supportId,
    this.loading = false,
    this.error,
  });

  const WalletState.empty()
      : balance = 0,
        owed = 0,
        everPurchased = false,
        supportId = null,
        loading = false,
        error = null;

  /// Reads `GET /balance`.
  factory WalletState.fromJson(Map<String, dynamic> json) => WalletState(
        balance: readInt(json['balance']),
        owed: readInt(json['owed']),
        everPurchased: readBool(json['ever_purchased']),
        supportId: readStringOrNull(json['support_id']),
      );

  final int balance;

  /// Credits owed after a purchase was reversed. Spending is blocked while this is above 0.
  final int owed;

  /// True once the wallet has bought credits (analysis is gated on it).
  final bool everPurchased;

  /// A short, non-secret code that helps support find the wallet.
  final String? supportId;
  final bool loading;
  final AppError? error;

  bool get hasDebt => owed > 0;

  WalletState copyWith({
    int? balance,
    int? owed,
    bool? everPurchased,
    String? supportId,
    bool? loading,
    AppError? error,
    bool clearError = false,
  }) =>
      WalletState(
        balance: balance ?? this.balance,
        owed: owed ?? this.owed,
        everPurchased: everPurchased ?? this.everPurchased,
        supportId: supportId ?? this.supportId,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );

  @override
  bool operator ==(Object other) =>
      other is WalletState &&
      other.balance == balance &&
      other.owed == owed &&
      other.everPurchased == everPurchased &&
      other.supportId == supportId &&
      other.loading == loading &&
      other.error == error;

  @override
  int get hashCode => Object.hash(balance, owed, everPurchased, supportId, loading, error);
}
