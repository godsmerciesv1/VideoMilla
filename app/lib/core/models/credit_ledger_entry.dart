import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

/// The ledger kinds the Worker writes (blueprint Sections 23.3, 53.2).
abstract final class LedgerKind {
  static const String reserve = 'reserve';
  static const String refund = 'refund';
  static const String purchase = 'purchase';
  static const String voidKind = 'void';
  static const String mergeIn = 'merge_in';
  static const String mergeOut = 'merge_out';
  static const String referralBonus = 'referral_bonus';
  static const String referralSettle = 'referral_settle';
  static const String referralVoid = 'referral_void';
}

/// A local mirror of one ledger row, for display only. The server is the source of truth.
@immutable
class CreditLedgerEntry {
  const CreditLedgerEntry({
    required this.delta,
    required this.kind,
    required this.createdAt,
    this.ref,
  });

  factory CreditLedgerEntry.fromJson(Map<String, dynamic> json) => CreditLedgerEntry(
        delta: readInt(json['delta']),
        kind: readString(json['kind']),
        ref: readStringOrNull(json['ref']),
        createdAt: readDate(json['createdAt']),
      );

  /// A row as the Worker exports it (`created_at` is in seconds, not milliseconds).
  factory CreditLedgerEntry.fromServerJson(Map<String, dynamic> json) => CreditLedgerEntry(
        delta: readInt(json['delta']),
        kind: readString(json['kind']),
        ref: readStringOrNull(json['ref']),
        createdAt: DateTime.fromMillisecondsSinceEpoch(readInt(json['created_at']) * 1000, isUtc: true),
      );

  /// Positive adds credits, negative spends them.
  final int delta;
  final String kind;
  final String? ref;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'delta': delta,
        'kind': kind,
        'ref': ref,
        'createdAt': dateToMs(createdAt),
      };

  @override
  bool operator ==(Object other) =>
      other is CreditLedgerEntry &&
      other.delta == delta &&
      other.kind == kind &&
      other.ref == ref &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(delta, kind, ref, createdAt);
}
