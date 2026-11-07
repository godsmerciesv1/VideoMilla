import 'package:flutter/foundation.dart';

import 'character_profile.dart';
import 'json_helpers.dart';
import 'project.dart';

/// A saved place that episodes can return to.
@immutable
class SeriesLocation {
  const SeriesLocation({required this.name, this.description = '', this.referencePath});

  factory SeriesLocation.fromJson(Map<String, dynamic> json) => SeriesLocation(
        name: readString(json['name']),
        description: readString(json['description']),
        referencePath: readStringOrNull(json['referencePath']),
      );

  final String name;
  final String description;
  final String? referencePath;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'description': description,
        'referencePath': referencePath,
      };

  @override
  bool operator ==(Object other) =>
      other is SeriesLocation &&
      other.name == name &&
      other.description == description &&
      other.referencePath == referencePath;

  @override
  int get hashCode => Object.hash(name, description, referencePath);
}

/// A series: a saved bible plus linked episodes. Series live on the device.
@immutable
class Series {
  const Series({
    required this.id,
    required this.title,
    this.language = 'en',
    this.aspect = AspectOption.portrait,
    this.styleId = StyleId.storybook,
    this.captionStyle = CaptionStyle.bold,
    this.narratorVoiceId,
    this.characters = const <CharacterProfile>[],
    this.locations = const <SeriesLocation>[],
    this.summary = '',
    this.episodeIds = const <String>[],
    this.schemaVersion = currentSchemaVersion,
  });

  factory Series.fromJson(Map<String, dynamic> json) => Series(
        id: requireString(json, 'id', model: 'Series'),
        title: readString(json['title']),
        language: readString(json['language'], 'en'),
        aspect: enumFromName(AspectOption.values, json['aspect'], orElse: AspectOption.portrait),
        styleId: styleIdFromWire(json['styleId']),
        captionStyle: enumFromName(CaptionStyle.values, json['captionStyle'], orElse: CaptionStyle.bold),
        narratorVoiceId: readStringOrNull(json['narratorVoiceId']),
        characters:
            List<CharacterProfile>.unmodifiable(readMapList(json['characters']).map(CharacterProfile.fromJson)),
        locations: List<SeriesLocation>.unmodifiable(readMapList(json['locations']).map(SeriesLocation.fromJson)),
        summary: readString(json['summary']),
        episodeIds: readStringList(json['episodeIds']),
        schemaVersion: readInt(json['schemaVersion'], currentSchemaVersion),
      );

  static const int currentSchemaVersion = 1;

  /// The running summary is kept to 150 words or less.
  static const int maxSummaryWords = 150;

  final String id;
  final String title;
  final String language;
  final AspectOption aspect;
  final StyleId styleId;
  final CaptionStyle captionStyle;
  final String? narratorVoiceId;

  /// Approved characters with their voices: reusing one in an episode costs nothing.
  final List<CharacterProfile> characters;
  final List<SeriesLocation> locations;
  final String summary;
  final List<String> episodeIds;
  final int schemaVersion;

  int get summaryWordCount {
    final t = summary.trim();
    return t.isEmpty ? 0 : t.split(RegExp(r'\s+')).length;
  }

  Series copyWith({
    String? title,
    String? language,
    AspectOption? aspect,
    StyleId? styleId,
    CaptionStyle? captionStyle,
    String? narratorVoiceId,
    List<CharacterProfile>? characters,
    List<SeriesLocation>? locations,
    String? summary,
    List<String>? episodeIds,
  }) =>
      Series(
        id: id,
        title: title ?? this.title,
        language: language ?? this.language,
        aspect: aspect ?? this.aspect,
        styleId: styleId ?? this.styleId,
        captionStyle: captionStyle ?? this.captionStyle,
        narratorVoiceId: narratorVoiceId ?? this.narratorVoiceId,
        characters: characters ?? this.characters,
        locations: locations ?? this.locations,
        summary: summary ?? this.summary,
        episodeIds: episodeIds ?? this.episodeIds,
        schemaVersion: schemaVersion,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'schemaVersion': schemaVersion,
        'id': id,
        'title': title,
        'language': language,
        'aspect': aspect.name,
        'styleId': styleId.wire,
        'captionStyle': captionStyle.name,
        'narratorVoiceId': narratorVoiceId,
        'characters': <Map<String, dynamic>>[for (final c in characters) c.toJson()],
        'locations': <Map<String, dynamic>>[for (final l in locations) l.toJson()],
        'summary': summary,
        'episodeIds': episodeIds,
      };

  @override
  bool operator ==(Object other) =>
      other is Series &&
      other.id == id &&
      other.title == title &&
      other.language == language &&
      other.aspect == aspect &&
      other.styleId == styleId &&
      other.captionStyle == captionStyle &&
      other.narratorVoiceId == narratorVoiceId &&
      sameList(other.characters, characters) &&
      sameList(other.locations, locations) &&
      other.summary == summary &&
      sameList(other.episodeIds, episodeIds) &&
      other.schemaVersion == schemaVersion;

  @override
  int get hashCode => Object.hashAll(<Object?>[
        id,
        title,
        language,
        aspect,
        styleId,
        captionStyle,
        narratorVoiceId,
        Object.hashAll(characters),
        Object.hashAll(locations),
        summary,
        Object.hashAll(episodeIds),
        schemaVersion,
      ]);
}
