import 'package:flutter/foundation.dart';

/// The 4 px grid. The only gaps widgets may use; unrelated elements never
/// share one uniform gap.
@immutable
class AppSpace {
  const AppSpace();

  double get s2 => 2;
  double get s4 => 4;
  double get s8 => 8;
  double get s16 => 16;
  double get s24 => 24;
  double get s32 => 32;
  double get s48 => 48;
  double get s64 => 64;

  /// Minimum touch target on both axes.
  double get minTarget => 48;
}
