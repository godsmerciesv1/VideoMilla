import 'package:flutter/foundation.dart';

import '../errors/app_error.dart';

/// Small readers shared by every model's `fromJson`. A missing or wrongly
/// typed *required* value means stored data is damaged and raises
/// `AppError.corrupt`, which sends the user down the recovery path.

/// Reads an enum by name; an unknown stored value falls back to [orElse].
T enumFromName<T extends Enum>(List<T> values, Object? name, {required T orElse}) {
  for (final v in values) {
    if (v.name == name) return v;
  }
  return orElse;
}

String requireString(Map<String, dynamic> json, String key, {required String model}) {
  final v = json[key];
  if (v is String && v.isNotEmpty) return v;
  throw AppError.corrupt(detail: '$model.$key');
}

String readString(Object? v, [String fallback = '']) => v is String ? v : fallback;
String? readStringOrNull(Object? v) => v is String ? v : null;
int readInt(Object? v, [int fallback = 0]) => v is num ? v.toInt() : fallback;
int? readIntOrNull(Object? v) => v is num ? v.toInt() : null;
double readDouble(Object? v, [double fallback = 0]) => v is num ? v.toDouble() : fallback;
bool readBool(Object? v, [bool fallback = false]) => v is bool ? v : fallback;

List<String> readStringList(Object? v) {
  if (v is List<dynamic>) return List<String>.unmodifiable(v.whereType<String>());
  return const <String>[];
}

Map<String, dynamic> readMap(Object? v) {
  if (v is Map<String, dynamic>) return v;
  if (v is Map<dynamic, dynamic>) return Map<String, dynamic>.from(v);
  return const <String, dynamic>{};
}

List<Map<String, dynamic>> readMapList(Object? v) {
  if (v is List<dynamic>) {
    return List<Map<String, dynamic>>.unmodifiable(
      v.whereType<Map<dynamic, dynamic>>().map(Map<String, dynamic>.from),
    );
  }
  return const <Map<String, dynamic>>[];
}

/// Dates are stored as milliseconds since the epoch (UTC).
DateTime readDate(Object? v) => DateTime.fromMillisecondsSinceEpoch(readInt(v), isUtc: true);
int dateToMs(DateTime d) => d.millisecondsSinceEpoch;

bool sameList<T>(List<T> a, List<T> b) => listEquals<T>(a, b);
