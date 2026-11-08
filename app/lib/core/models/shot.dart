import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum MotionKind { animate, zoomIn, zoomOut, panLeft, panRight, hold }

extension MotionKindX on MotionKind {
  /// The name the Worker's schema uses.
  String get wire {
    switch (this) {
      case MotionKind.animate:
        return 'animate';
      case MotionKind.zoomIn:
        return 'zoom_in';
      case MotionKind.zoomOut:
        return 'zoom_out';
      case MotionKind.panLeft:
        return 'pan_left';
      case MotionKind.panRight:
        return 'pan_right';
      case MotionKind.hold:
        return 'hold';
    }
  }
}

MotionKind motionKindFromWire(Object? wire, {MotionKind orElse = MotionKind.zoomIn}) {
  for (final m in MotionKind.values) {
    if (m.wire == wire) return m;
  }
  return orElse;
}

/// A shot is a persisted state machine (blueprint Section 5.6).
enum ShotState { pending, reserved, generating, ready, approved, failedRetriable, failedTerminal }

/// One line a character speaks inside a shot.
@immutable
class SpeakerLine {
  const SpeakerLine({required this.characterId, required this.text, this.audioPath, this.audioMs});

  factory SpeakerLine.fromJson(Map<String, dynamic> json) => SpeakerLine(
        characterId: readString(json['characterId']),
        text: readString(json['text']),
        audioPath: readStringOrNull(json['audioPath']),
        audioMs: readIntOrNull(json['audioMs']),
      );

  final String characterId;
  final String text;
  final String? audioPath;
  final int? audioMs;

  SpeakerLine copyWith({String? characterId, String? text, String? audioPath, int? audioMs}) => SpeakerLine(
        characterId: characterId ?? this.characterId,
        text: text ?? this.text,
        audioPath: audioPath ?? this.audioPath,
        audioMs: audioMs ?? this.audioMs,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'characterId': characterId,
        'text': text,
        'audioPath': audioPath,
        'audioMs': audioMs,
      };

  @override
  bool operator ==(Object other) =>
      other is SpeakerLine &&
      other.characterId == characterId &&
      other.text == text &&
      other.audioPath == audioPath &&
      other.audioMs == audioMs;

  @override
  int get hashCode => Object.hash(characterId, text, audioPath, audioMs);
}

/// One shot of a video. Persisted.
@immutable
class Shot {
  const Shot({
    required this.id,
    required this.sceneId,
    required this.order,
    required this.durationMs,
    required this.visual,
    this.narration = '',
    this.narrationEn,
    this.lines = const <SpeakerLine>[],
    this.motion = MotionKind.zoomIn,
    this.characterIds = const <String>[],
    this.state = ShotState.pending,
    this.imagePath,
    this.narrationAudioPath,
    this.narrationAudioMs,
    this.clipId,
    this.approved = false,
    this.schemaVersion = currentSchemaVersion,
  });

  factory Shot.fromJson(Map<String, dynamic> json) => Shot(
        id: requireString(json, 'id', model: 'Shot'),
        sceneId: readString(json['sceneId']),
        order: readInt(json['order']),
        durationMs: readInt(json['durationMs'], 5000),
        visual: readString(json['visual']),
        narration: readString(json['narration']),
        narrationEn: readStringOrNull(json['narrationEn']),
        lines: List<SpeakerLine>.unmodifiable(readMapList(json['lines']).map(SpeakerLine.fromJson)),
        motion: motionKindFromWire(json['motion']),
        characterIds: readStringList(json['characterIds']),
        state: enumFromName(ShotState.values, json['state'], orElse: ShotState.pending),
        imagePath: readStringOrNull(json['imagePath']),
        narrationAudioPath: readStringOrNull(json['narrationAudioPath']),
        narrationAudioMs: readIntOrNull(json['narrationAudioMs']),
        clipId: readStringOrNull(json['clipId']),
        approved: readBool(json['approved']),
        schemaVersion: readInt(json['schemaVersion'], currentSchemaVersion),
      );

  static const int currentSchemaVersion = 1;

  final String id;
  final String sceneId;
  final int order;
  final int durationMs;

  /// What the picture shows (English, assembled into the picture prompt).
  final String visual;
  final String narration;

  /// English translation of the narration, used only for the safety check.
  final String? narrationEn;
  final List<SpeakerLine> lines;
  final MotionKind motion;
  final List<String> characterIds;
  final ShotState state;
  final String? imagePath;
  final String? narrationAudioPath;

  /// Length of the narration audio. The render plan needs it to place voices and size the shot.
  final int? narrationAudioMs;
  final String? clipId;
  final bool approved;
  final int schemaVersion;

  /// A shot carries narration OR speaker lines, never both when it is animated.
  bool get isTalkingCandidate => lines.length == 1 && narration.isEmpty;
  bool get isAnimated => motion == MotionKind.animate;
  bool get hasImage => imagePath != null;

  Shot copyWith({
    String? sceneId,
    int? order,
    int? durationMs,
    String? visual,
    String? narration,
    String? narrationEn,
    List<SpeakerLine>? lines,
    MotionKind? motion,
    List<String>? characterIds,
    ShotState? state,
    String? imagePath,
    String? narrationAudioPath,
    int? narrationAudioMs,
    String? clipId,
    bool? approved,
    bool clearImage = false,
    bool clearNarrationAudio = false,
    bool clearClip = false,
  }) =>
      Shot(
        id: id,
        sceneId: sceneId ?? this.sceneId,
        order: order ?? this.order,
        durationMs: durationMs ?? this.durationMs,
        visual: visual ?? this.visual,
        narration: narration ?? this.narration,
        narrationEn: narrationEn ?? this.narrationEn,
        lines: lines ?? this.lines,
        motion: motion ?? this.motion,
        characterIds: characterIds ?? this.characterIds,
        state: state ?? this.state,
        imagePath: clearImage ? null : (imagePath ?? this.imagePath),
        narrationAudioPath: clearNarrationAudio ? null : (narrationAudioPath ?? this.narrationAudioPath),
        narrationAudioMs: clearNarrationAudio ? null : (narrationAudioMs ?? this.narrationAudioMs),
        clipId: clearClip ? null : (clipId ?? this.clipId),
        approved: approved ?? this.approved,
        schemaVersion: schemaVersion,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'schemaVersion': schemaVersion,
        'id': id,
        'sceneId': sceneId,
        'order': order,
        'durationMs': durationMs,
        'visual': visual,
        'narration': narration,
        'narrationEn': narrationEn,
        'lines': <Map<String, dynamic>>[for (final l in lines) l.toJson()],
        'motion': motion.wire,
        'characterIds': characterIds,
        'state': state.name,
        'imagePath': imagePath,
        'narrationAudioPath': narrationAudioPath,
        'narrationAudioMs': narrationAudioMs,
        'clipId': clipId,
        'approved': approved,
      };

  @override
  bool operator ==(Object other) =>
      other is Shot &&
      other.id == id &&
      other.sceneId == sceneId &&
      other.order == order &&
      other.durationMs == durationMs &&
      other.visual == visual &&
      other.narration == narration &&
      other.narrationEn == narrationEn &&
      sameList(other.lines, lines) &&
      other.motion == motion &&
      sameList(other.characterIds, characterIds) &&
      other.state == state &&
      other.imagePath == imagePath &&
      other.narrationAudioPath == narrationAudioPath &&
      other.narrationAudioMs == narrationAudioMs &&
      other.clipId == clipId &&
      other.approved == approved &&
      other.schemaVersion == schemaVersion;

  @override
  int get hashCode => Object.hashAll(<Object?>[
        id,
        sceneId,
        order,
        durationMs,
        visual,
        narration,
        narrationEn,
        Object.hashAll(lines),
        motion,
        Object.hashAll(characterIds),
        state,
        imagePath,
        narrationAudioPath,
        narrationAudioMs,
        clipId,
        approved,
        schemaVersion,
      ]);
}
