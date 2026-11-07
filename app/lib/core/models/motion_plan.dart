import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

/// Green: the video will look complete. Amber: heavier use. Red: needs confirmation.
enum AnimationZone { green, amber, red }

/// The animation choice for a project: how many shots move, what it costs and
/// which warning applies (blueprint Section 5.7). The numbers come from the
/// pure planner (`animation_planner.dart`); this class only holds them.
@immutable
class MotionPlan {
  const MotionPlan({
    required this.n,
    required this.recommended,
    required this.heavierMax,
    required this.selectedShotIds,
    required this.zone,
    required this.credits,
    required this.animatedSeconds,
    this.warningKeys = const <String>[],
  });

  factory MotionPlan.fromJson(Map<String, dynamic> json) => MotionPlan(
        n: readInt(json['n']),
        recommended: readInt(json['recommended']),
        heavierMax: readInt(json['heavierMax']),
        selectedShotIds: readStringList(json['selectedShotIds']),
        zone: enumFromName(AnimationZone.values, json['zone'], orElse: AnimationZone.green),
        credits: readInt(json['credits']),
        animatedSeconds: readInt(json['animatedSeconds']),
        warningKeys: readStringList(json['warningKeys']),
      );

  /// Number of shots in the project.
  final int n;

  /// R = max(1, round(n / 3)).
  final int recommended;

  /// H = half of n, rounded up.
  final int heavierMax;
  final List<String> selectedShotIds;
  final AnimationZone zone;
  final int credits;
  final int animatedSeconds;

  /// Keys of the localized warning strings for this zone.
  final List<String> warningKeys;

  /// How many shots are animated.
  int get k => selectedShotIds.length;

  /// Red zone: the user must confirm.
  bool get needsConfirmHigh => k > heavierMax;

  /// Choosing every shot (three or more) needs an extra checkbox.
  bool get needsConfirmAll => k == n && n >= 3;

  MotionPlan copyWith({
    int? n,
    int? recommended,
    int? heavierMax,
    List<String>? selectedShotIds,
    AnimationZone? zone,
    int? credits,
    int? animatedSeconds,
    List<String>? warningKeys,
  }) =>
      MotionPlan(
        n: n ?? this.n,
        recommended: recommended ?? this.recommended,
        heavierMax: heavierMax ?? this.heavierMax,
        selectedShotIds: selectedShotIds ?? this.selectedShotIds,
        zone: zone ?? this.zone,
        credits: credits ?? this.credits,
        animatedSeconds: animatedSeconds ?? this.animatedSeconds,
        warningKeys: warningKeys ?? this.warningKeys,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'n': n,
        'recommended': recommended,
        'heavierMax': heavierMax,
        'selectedShotIds': selectedShotIds,
        'zone': zone.name,
        'credits': credits,
        'animatedSeconds': animatedSeconds,
        'warningKeys': warningKeys,
      };

  @override
  bool operator ==(Object other) =>
      other is MotionPlan &&
      other.n == n &&
      other.recommended == recommended &&
      other.heavierMax == heavierMax &&
      sameList(other.selectedShotIds, selectedShotIds) &&
      other.zone == zone &&
      other.credits == credits &&
      other.animatedSeconds == animatedSeconds &&
      sameList(other.warningKeys, warningKeys);

  @override
  int get hashCode => Object.hash(
        n,
        recommended,
        heavierMax,
        Object.hashAll(selectedShotIds),
        zone,
        credits,
        animatedSeconds,
        Object.hashAll(warningKeys),
      );
}
