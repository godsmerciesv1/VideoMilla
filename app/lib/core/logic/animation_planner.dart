import 'dart:math' as math;

import '../models/motion_plan.dart';
import '../models/shot.dart';
import 'ledger_math.dart';

/// Localized-string keys of the animation warnings (blueprint Section 5.7).
abstract final class WarnKey {
  static const String extraCost = 'warnExtraCost';
  static const String waiting = 'warnWaiting';
  static const String drift = 'warnDrift';
  static const String refundOnFail = 'warnRefundOnFail';
  static const String slowerRender = 'warnSlowerRender';
  static const String busy = 'warnBusy';
  static const String tryRecommended = 'warnTryRecommended';
}

/// The recommended number of animated shots: about one in three, at least one.
/// n = 6 gives 2, n = 9 gives 3, n = 15 gives 5.
int recommended(int n) => n <= 0 ? 0 : math.max(1, (n / 3).round());

/// The most animated shots before the red zone: half of n, rounded up.
int heavierMax(int n) => (n + 1) ~/ 2;

/// Green: up to the recommended count. Amber: above it, up to half. Red: beyond half.
AnimationZone zoneFor(int n, int k) {
  final r = recommended(n);
  if (k <= r) return AnimationZone.green;
  if (k <= math.max(r, heavierMax(n))) return AnimationZone.amber;
  return AnimationZone.red;
}

/// Choosing every shot (three or more) needs an extra confirmation.
bool needsConfirmAll(int n, int k) => k == n && n >= 3;

/// The warnings that apply to a zone. Green has none; amber has the heavier-use
/// text; red adds the full list of implications.
List<String> warningKeys(AnimationZone zone) {
  switch (zone) {
    case AnimationZone.green:
      return const <String>[];
    case AnimationZone.amber:
      return const <String>[WarnKey.extraCost, WarnKey.waiting, WarnKey.drift, WarnKey.tryRecommended];
    case AnimationZone.red:
      return const <String>[
        WarnKey.extraCost,
        WarnKey.waiting,
        WarnKey.drift,
        WarnKey.refundOnFail,
        WarnKey.slowerRender,
        WarnKey.busy,
        WarnKey.tryRecommended,
      ];
  }
}

int _score(Shot s, int index, int count) {
  var score = 0;
  if (index == 0) score += 3;
  if (index == count - 1 && count > 1) score += 1;
  if (s.isTalkingCandidate) score += 2;
  if (s.motion == MotionKind.animate) score += 2;
  return score;
}

/// The AI's pick: the top [recommended] shots by score (first shot +3, last +1,
/// a shot with one speaker line +2, a shot the structuring step marked as action +2).
/// Ties go to the earlier shot. The result is in shot order.
List<String> autoSelect(List<Shot> shots) {
  final ordered = List<Shot>.of(shots)..sort((a, b) => a.order.compareTo(b.order));
  final scored = <({Shot shot, int score, int index})>[
    for (var i = 0; i < ordered.length; i++) (shot: ordered[i], score: _score(ordered[i], i, ordered.length), index: i),
  ]..sort((a, b) {
      final byScore = b.score.compareTo(a.score);
      return byScore != 0 ? byScore : a.index.compareTo(b.index);
    });
  final picked = scored.take(recommended(ordered.length)).toList()..sort((a, b) => a.index.compareTo(b.index));
  return <String>[for (final e in picked) e.shot.id];
}

/// Longest line audio that can be lip-synced (a talking shot).
const int maxTalkingMs = 8000;

/// Clip length bounds in seconds.
const int minClipSeconds = 3;
const int maxClipSeconds = 8;

/// Builds the plan for a selection: total credits, animated seconds, zone and warnings.
/// A talking shot (one line, audio known and at most 8 s) is billed by its audio.
MotionPlan plan(List<Shot> shots, List<String> selected, {int defaultClipSeconds = 5, int perSecond = 2}) {
  final n = shots.length;
  final byId = <String, Shot>{for (final s in shots) s.id: s};
  final chosen = <String>[for (final id in selected) if (byId.containsKey(id)) id];
  var credits = 0;
  var seconds = 0;
  for (final id in chosen) {
    final shot = byId[id]!;
    final audioMs = shot.lines.length == 1 ? shot.lines.first.audioMs : null;
    if (shot.isTalkingCandidate && audioMs != null && audioMs <= maxTalkingMs) {
      credits += talkingClipCredits(audioMs, perSecond: perSecond);
      seconds += math.max(minClipSeconds, (audioMs / 1000).ceil());
    } else {
      credits += clipCredits(defaultClipSeconds, perSecond: perSecond);
      seconds += defaultClipSeconds;
    }
  }
  final zone = zoneFor(n, chosen.length);
  return MotionPlan(
    n: n,
    recommended: recommended(n),
    heavierMax: heavierMax(n),
    selectedShotIds: chosen,
    zone: zone,
    credits: credits,
    animatedSeconds: seconds,
    warningKeys: warningKeys(zone),
  );
}
