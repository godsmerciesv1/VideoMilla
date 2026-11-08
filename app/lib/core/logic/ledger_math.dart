import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../models/credit_pack.dart';

/// What a paid action would do to the balance. Shown before every confirmation.
@immutable
class CostPreview {
  const CostPreview({required this.cost, required this.balance, required this.balanceAfter, required this.shortBy});

  final int cost;
  final int balance;
  final int balanceAfter;

  /// Credits missing to afford the action (0 when affordable).
  final int shortBy;

  bool get canAfford => shortBy == 0;
}

CostPreview previewCost({required int cost, required int balance}) => CostPreview(
      cost: cost,
      balance: balance,
      balanceAfter: balance - cost,
      shortBy: math.max(0, cost - balance),
    );

/// Credits for an animated clip: 2 per second (3 s = 6, 5 s = 10, 8 s = 16).
/// [perSecond] comes from server config; 2 is the blueprint default.
int clipCredits(int seconds, {int perSecond = 2}) => perSecond * seconds;

/// A talking shot is billed by its audio: the larger of 6 and 2 per started second.
int talkingClipCredits(int audioMs, {int perSecond = 2, int minimum = 6}) =>
    math.max(minimum, perSecond * (audioMs / 1000).ceil());

/// Estimated credits for a whole project (blueprint Section 7 examples:
/// 3 shots, 1 character, 1 animated = 17; 9 shots, 2 characters, 9 animated = 107).
int projectEstimate({
  required int shotCount,
  required int characterCount,
  required int animatedCount,
  int clipSeconds = 5,
  int pictureCost = 1,
  int characterSheetCost = 4,
  int perSecond = 2,
}) =>
    characterCount * characterSheetCost +
    shotCount * pictureCost +
    animatedCount * clipCredits(clipSeconds, perSecond: perSecond);

/// The smallest pack that covers [shortBy] credits. When no single pack covers it,
/// the largest pack (the user can buy more than one). Null when there are no packs.
CreditPack? smallestCoveringPack(int shortBy, List<CreditPack> packs) {
  if (packs.isEmpty) return null;
  final sorted = List<CreditPack>.of(packs)..sort((a, b) => a.credits.compareTo(b.credits));
  for (final p in sorted) {
    if (p.credits >= shortBy) return p;
  }
  return sorted.last;
}

/// Worst-case provider cost per credit divided by the store's 85% share
/// (blueprint Section 7): a regional price must stay above credits x 0.0147.
const double minPricePerCredit = 0.0147;

bool regionalPriceOk(double price, int credits) => price + 1e-9 >= credits * minPricePerCredit;
