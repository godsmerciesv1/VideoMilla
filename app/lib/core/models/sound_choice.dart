import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum SoundSource { none, library, user }

/// The optional background sound chosen at the Render step (blueprint Section 54).
/// It costs nothing, is mixed under the narration, and a user's own file is never uploaded.
@immutable
class SoundChoice {
  const SoundChoice({
    this.source = SoundSource.none,
    this.trackId,
    this.userPath,
    this.volume = defaultVolume,
    this.fadeMs = defaultFadeMs,
  });

  factory SoundChoice.fromJson(Map<String, dynamic> json) => SoundChoice(
        source: enumFromName(SoundSource.values, json['source'], orElse: SoundSource.none),
        trackId: readStringOrNull(json['trackId']),
        userPath: readStringOrNull(json['userPath']),
        volume: readInt(json['volume'], defaultVolume).clamp(0, 100).toInt(),
        fadeMs: readInt(json['fadeMs'], defaultFadeMs),
      );

  /// Volume 0 to 100; the default sits well under the narration.
  static const int defaultVolume = 20;

  /// Fade-out at the end of the video (decision D-054).
  static const int defaultFadeMs = 2000;

  final SoundSource source;

  /// Library track ID when [source] is [SoundSource.library].
  final String? trackId;

  /// Local path of the user's own file when [source] is [SoundSource.user].
  final String? userPath;
  final int volume;
  final int fadeMs;

  bool get isNone => source == SoundSource.none;

  SoundChoice copyWith({SoundSource? source, String? trackId, String? userPath, int? volume, int? fadeMs}) =>
      SoundChoice(
        source: source ?? this.source,
        trackId: trackId ?? this.trackId,
        userPath: userPath ?? this.userPath,
        volume: (volume ?? this.volume).clamp(0, 100).toInt(),
        fadeMs: fadeMs ?? this.fadeMs,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'source': source.name,
        'trackId': trackId,
        'userPath': userPath,
        'volume': volume,
        'fadeMs': fadeMs,
      };

  @override
  bool operator ==(Object other) =>
      other is SoundChoice &&
      other.source == source &&
      other.trackId == trackId &&
      other.userPath == userPath &&
      other.volume == volume &&
      other.fadeMs == fadeMs;

  @override
  int get hashCode => Object.hash(source, trackId, userPath, volume, fadeMs);
}

/// One entry of the website's `sounds/manifest.json`.
@immutable
class SoundTrack {
  const SoundTrack({
    required this.id,
    required this.title,
    required this.file,
    this.kind = 'music',
    this.seconds = 0,
    this.author = '',
    this.source = '',
    this.license = 'CC0',
    this.checked = '',
  });

  factory SoundTrack.fromJson(Map<String, dynamic> json) => SoundTrack(
        id: requireString(json, 'id', model: 'SoundTrack'),
        title: readString(json['title']),
        file: requireString(json, 'file', model: 'SoundTrack'),
        kind: readString(json['kind'], 'music'),
        seconds: readInt(json['seconds']),
        author: readString(json['author']),
        source: readString(json['source']),
        license: readString(json['license'], 'CC0'),
        checked: readString(json['checked']),
      );

  final String id;
  final String title;

  /// File name under the site's `sounds/` folder.
  final String file;

  /// `music` or `ambient`.
  final String kind;
  final int seconds;
  final String author;
  final String source;
  final String license;
  final String checked;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'title': title,
        'kind': kind,
        'seconds': seconds,
        'file': file,
        'author': author,
        'source': source,
        'license': license,
        'checked': checked,
      };

  @override
  bool operator ==(Object other) =>
      other is SoundTrack &&
      other.id == id &&
      other.title == title &&
      other.file == file &&
      other.kind == kind &&
      other.seconds == seconds &&
      other.author == author &&
      other.source == source &&
      other.license == license &&
      other.checked == checked;

  @override
  int get hashCode => Object.hash(id, title, file, kind, seconds, author, source, license, checked);
}
