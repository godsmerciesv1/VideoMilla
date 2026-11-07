import 'package:flutter/foundation.dart';

import 'json_helpers.dart';
import 'project.dart';
import 'shot.dart';
import 'sound_choice.dart';
import 'style_preset.dart';

enum SegmentKind { still, clip }

/// One piece of the video timeline: a picture with a motion, or an animated clip.
@immutable
class RenderSegment {
  const RenderSegment({
    required this.shotId,
    required this.kind,
    required this.path,
    required this.startMs,
    required this.durationMs,
    this.motion = MotionKind.hold,
  });

  factory RenderSegment.fromJson(Map<String, dynamic> json) => RenderSegment(
        shotId: readString(json['shotId']),
        kind: enumFromName(SegmentKind.values, json['kind'], orElse: SegmentKind.still),
        path: readString(json['path']),
        startMs: readInt(json['startMs']),
        durationMs: readInt(json['durationMs']),
        motion: motionKindFromWire(json['motion'], orElse: MotionKind.hold),
      );

  final String shotId;
  final SegmentKind kind;

  /// Picture file for a still, video file for a clip.
  final String path;
  final int startMs;

  /// For a clip this is the clip's real length, which wins over the shot's planned length.
  final int durationMs;

  /// Camera motion for a still. Unused for a clip.
  final MotionKind motion;

  int get endMs => startMs + durationMs;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'shotId': shotId,
        'kind': kind.name,
        'path': path,
        'startMs': startMs,
        'durationMs': durationMs,
        'motion': motion.wire,
      };

  @override
  bool operator ==(Object other) =>
      other is RenderSegment &&
      other.shotId == shotId &&
      other.kind == kind &&
      other.path == path &&
      other.startMs == startMs &&
      other.durationMs == durationMs &&
      other.motion == motion;

  @override
  int get hashCode => Object.hash(shotId, kind, path, startMs, durationMs, motion);
}

enum AudioKind { narration, line }

/// One voice file placed on the timeline. Voices never overlap.
@immutable
class AudioEvent {
  const AudioEvent({
    required this.path,
    required this.offsetMs,
    required this.durationMs,
    this.kind = AudioKind.narration,
    this.characterId,
  });

  factory AudioEvent.fromJson(Map<String, dynamic> json) => AudioEvent(
        path: readString(json['path']),
        offsetMs: readInt(json['offsetMs']),
        durationMs: readInt(json['durationMs']),
        kind: enumFromName(AudioKind.values, json['kind'], orElse: AudioKind.narration),
        characterId: readStringOrNull(json['characterId']),
      );

  final String path;
  final int offsetMs;
  final int durationMs;
  final AudioKind kind;

  /// The speaking character for a [AudioKind.line] event.
  final String? characterId;

  int get endMs => offsetMs + durationMs;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'path': path,
        'offsetMs': offsetMs,
        'durationMs': durationMs,
        'kind': kind.name,
        'characterId': characterId,
      };

  @override
  bool operator ==(Object other) =>
      other is AudioEvent &&
      other.path == path &&
      other.offsetMs == offsetMs &&
      other.durationMs == durationMs &&
      other.kind == kind &&
      other.characterId == characterId;

  @override
  int get hashCode => Object.hash(path, offsetMs, durationMs, kind, characterId);
}

/// One caption shown from [startMs] to [endMs] (video time).
@immutable
class Caption {
  const Caption({required this.startMs, required this.endMs, required this.text});

  factory Caption.fromJson(Map<String, dynamic> json) => Caption(
        startMs: readInt(json['startMs']),
        endMs: readInt(json['endMs']),
        text: readString(json['text']),
      );

  final int startMs;
  final int endMs;
  final String text;

  int get durationMs => endMs - startMs;

  Map<String, dynamic> toJson() => <String, dynamic>{'startMs': startMs, 'endMs': endMs, 'text': text};

  @override
  bool operator ==(Object other) =>
      other is Caption && other.startMs == startMs && other.endMs == endMs && other.text == text;

  @override
  int get hashCode => Object.hash(startMs, endMs, text);
}

/// Everything a renderer needs, independent of platform. The Android and web
/// renderers consume the same spec (blueprint Section 13).
@immutable
class RenderSpec {
  const RenderSpec({
    required this.width,
    required this.height,
    required this.segments,
    required this.audioEvents,
    required this.captions,
    required this.totalMs,
    this.fps = defaultFps,
    this.grade = const ColorGrade(),
    this.language = 'en',
    this.captionStyle = CaptionStyle.bold,
    this.sound,
  });

  factory RenderSpec.fromJson(Map<String, dynamic> json) {
    final soundJson = json['sound'];
    return RenderSpec(
      width: readInt(json['width'], 720),
      height: readInt(json['height'], 1280),
      fps: readInt(json['fps'], defaultFps),
      segments: List<RenderSegment>.unmodifiable(readMapList(json['segments']).map(RenderSegment.fromJson)),
      audioEvents: List<AudioEvent>.unmodifiable(readMapList(json['audioEvents']).map(AudioEvent.fromJson)),
      captions: List<Caption>.unmodifiable(readMapList(json['captions']).map(Caption.fromJson)),
      grade: ColorGrade.fromJson(readMap(json['grade'])),
      language: readString(json['language'], 'en'),
      captionStyle: enumFromName(CaptionStyle.values, json['captionStyle'], orElse: CaptionStyle.bold),
      totalMs: readInt(json['totalMs']),
      sound: soundJson == null ? null : SoundChoice.fromJson(readMap(soundJson)),
    );
  }

  static const int defaultFps = 25;

  final int width;
  final int height;
  final int fps;
  final List<RenderSegment> segments;
  final List<AudioEvent> audioEvents;
  final List<Caption> captions;
  final ColorGrade grade;
  final String language;
  final CaptionStyle captionStyle;
  final int totalMs;

  /// Optional background sound (null or [SoundSource.none] means none).
  final SoundChoice? sound;

  bool get hasSound => sound != null && !sound!.isNone;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'width': width,
        'height': height,
        'fps': fps,
        'segments': <Map<String, dynamic>>[for (final s in segments) s.toJson()],
        'audioEvents': <Map<String, dynamic>>[for (final a in audioEvents) a.toJson()],
        'captions': <Map<String, dynamic>>[for (final c in captions) c.toJson()],
        'grade': grade.toJson(),
        'language': language,
        'captionStyle': captionStyle.name,
        'totalMs': totalMs,
        'sound': sound?.toJson(),
      };

  @override
  bool operator ==(Object other) =>
      other is RenderSpec &&
      other.width == width &&
      other.height == height &&
      other.fps == fps &&
      sameList(other.segments, segments) &&
      sameList(other.audioEvents, audioEvents) &&
      sameList(other.captions, captions) &&
      other.grade == grade &&
      other.language == language &&
      other.captionStyle == captionStyle &&
      other.totalMs == totalMs &&
      other.sound == sound;

  @override
  int get hashCode => Object.hashAll(<Object?>[
        width,
        height,
        fps,
        Object.hashAll(segments),
        Object.hashAll(audioEvents),
        Object.hashAll(captions),
        grade,
        language,
        captionStyle,
        totalMs,
        sound,
      ]);
}
