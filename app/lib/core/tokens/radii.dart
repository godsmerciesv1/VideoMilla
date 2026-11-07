import 'package:flutter/foundation.dart';

/// One corner radius per role. Larger, rounder shapes than the first draft
/// (decision D-035): cards 24, hero surfaces 32, buttons and chips fully round.
@immutable
class AppRadii {
  const AppRadii();

  /// Large enough to make any box fully round.
  static const double fullValue = 999;

  double get card => 24;
  double get hero => 32;
  double get tile => 16;
  double get input => 16;
  double get sheet => 32;
  double get shot => 16;
  double get button => fullValue;
  double get chip => fullValue;
}
