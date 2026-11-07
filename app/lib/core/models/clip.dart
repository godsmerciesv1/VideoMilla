import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum ClipState { queued, running, ready, kept, rejected, failedRetriable, failedTerminal }

/// One animated clip for a shot.
@immutable
class Clip {
  const Clip({
    required this.id,
    required this.shotId,
    required this.key,
    required this.seconds,
    required this.createdAt,
    this.provider,
    this.talking = false,
    this.state = ClipState.queued,
    this.videoPath,
  });

  factory Clip.fromJson(Map<String, dynamic> json) => Clip(
        id: requireString(json, 'id', model: 'Clip'),
        shotId: readString(json['shotId']),
        key: readString(json['key']),
        seconds: readInt(json['seconds'], 5),
        createdAt: readDate(json['createdAt']),
        provider: readStringOrNull(json['provider']),
        talking: readBool(json['talking']),
        state: enumFromName(ClipState.values, json['state'], orElse: ClipState.queued),
        videoPath: readStringOrNull(json['videoPath']),
      );

  final String id;
  final String shotId;

  /// Idempotency key of the paid request; a resumed job reuses it.
  final String key;

  /// 3 to 8 seconds.
  final int seconds;

  /// Which provider made it (recorded for support; never shown).
  final String? provider;

  /// A talking shot: the character's line audio drives the lip-sync.
  final bool talking;
  final ClipState state;
  final String? videoPath;
  final DateTime createdAt;

  bool get isFinished => state == ClipState.ready || state == ClipState.kept;

  Clip copyWith({String? provider, bool? talking, ClipState? state, String? videoPath, int? seconds}) => Clip(
        id: id,
        shotId: shotId,
        key: key,
        seconds: seconds ?? this.seconds,
        createdAt: createdAt,
        provider: provider ?? this.provider,
        talking: talking ?? this.talking,
        state: state ?? this.state,
        videoPath: videoPath ?? this.videoPath,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'shotId': shotId,
        'key': key,
        'seconds': seconds,
        'provider': provider,
        'talking': talking,
        'state': state.name,
        'videoPath': videoPath,
        'createdAt': dateToMs(createdAt),
      };

  @override
  bool operator ==(Object other) =>
      other is Clip &&
      other.id == id &&
      other.shotId == shotId &&
      other.key == key &&
      other.seconds == seconds &&
      other.provider == provider &&
      other.talking == talking &&
      other.state == state &&
      other.videoPath == videoPath &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(id, shotId, key, seconds, provider, talking, state, videoPath, createdAt);
}
