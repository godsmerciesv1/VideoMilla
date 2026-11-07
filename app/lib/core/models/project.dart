import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum AspectOption { portrait, landscape }

extension AspectOptionX on AspectOption {
  int get width => this == AspectOption.portrait ? 720 : 1280;
  int get height => this == AspectOption.portrait ? 1280 : 720;
  String get ratio => this == AspectOption.portrait ? '9:16' : '16:9';
}

enum StyleId { storybook, comic, flatVector, watercolor, inkNoir, cinematic, photorealStory, realisticScenes }

extension StyleIdX on StyleId {
  /// The name the Worker and the style asset file use.
  String get wire {
    switch (this) {
      case StyleId.storybook:
        return 'storybook';
      case StyleId.comic:
        return 'comic';
      case StyleId.flatVector:
        return 'flat_vector';
      case StyleId.watercolor:
        return 'watercolor';
      case StyleId.inkNoir:
        return 'ink_noir';
      case StyleId.cinematic:
        return 'cinematic';
      case StyleId.photorealStory:
        return 'photoreal_story';
      case StyleId.realisticScenes:
        return 'realistic_scenes';
    }
  }

  /// Children may appear only in the four cartoon styles (blueprint Section 5.2).
  bool get isCartoon =>
      this == StyleId.storybook ||
      this == StyleId.comic ||
      this == StyleId.flatVector ||
      this == StyleId.watercolor;
}

StyleId styleIdFromWire(Object? wire, {StyleId orElse = StyleId.storybook}) {
  for (final s in StyleId.values) {
    if (s.wire == wire) return s;
  }
  return orElse;
}

enum CaptionStyle { bold, clean, outline }

/// The optional brief (genre, tone, setting, character notes). Blanks are inferred by the AI.
@immutable
class Brief {
  const Brief({this.genre = '', this.tone = '', this.setting = '', this.characterNotes = ''});

  factory Brief.fromJson(Map<String, dynamic> json) => Brief(
        genre: readString(json['genre']),
        tone: readString(json['tone']),
        setting: readString(json['setting']),
        characterNotes: readString(json['characterNotes']),
      );

  final String genre;
  final String tone;
  final String setting;
  final String characterNotes;

  bool get isEmpty => genre.isEmpty && tone.isEmpty && setting.isEmpty && characterNotes.isEmpty;

  Brief copyWith({String? genre, String? tone, String? setting, String? characterNotes}) => Brief(
        genre: genre ?? this.genre,
        tone: tone ?? this.tone,
        setting: setting ?? this.setting,
        characterNotes: characterNotes ?? this.characterNotes,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'genre': genre,
        'tone': tone,
        'setting': setting,
        'characterNotes': characterNotes,
      };

  @override
  bool operator ==(Object other) =>
      other is Brief &&
      other.genre == genre &&
      other.tone == tone &&
      other.setting == setting &&
      other.characterNotes == characterNotes;

  @override
  int get hashCode => Object.hash(genre, tone, setting, characterNotes);
}

/// One video project. Persisted, so it carries a [schemaVersion].
@immutable
class Project {
  const Project({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    this.contentLanguage = 'en',
    this.aspect = AspectOption.portrait,
    this.aspectLocked = false,
    this.styleId = StyleId.storybook,
    this.captionStyle = CaptionStyle.bold,
    this.targetLengthS = 30,
    this.brief = const Brief(),
    this.scriptText = '',
    this.sceneIds = const <String>[],
    this.characterIds = const <String>[],
    this.narratorVoiceId,
    this.seriesId,
    this.episodeNumber,
    this.schemaVersion = currentSchemaVersion,
  });

  factory Project.fromJson(Map<String, dynamic> json) => Project(
        id: requireString(json, 'id', model: 'Project'),
        title: readString(json['title']),
        createdAt: readDate(json['createdAt']),
        updatedAt: readDate(json['updatedAt']),
        contentLanguage: readString(json['contentLanguage'], 'en'),
        aspect: enumFromName(AspectOption.values, json['aspect'], orElse: AspectOption.portrait),
        aspectLocked: readBool(json['aspectLocked']),
        styleId: styleIdFromWire(json['styleId']),
        captionStyle: enumFromName(CaptionStyle.values, json['captionStyle'], orElse: CaptionStyle.bold),
        targetLengthS: readInt(json['targetLengthS'], 30),
        brief: Brief.fromJson(readMap(json['brief'])),
        scriptText: readString(json['scriptText']),
        sceneIds: readStringList(json['sceneIds']),
        characterIds: readStringList(json['characterIds']),
        narratorVoiceId: readStringOrNull(json['narratorVoiceId']),
        seriesId: readStringOrNull(json['seriesId']),
        episodeNumber: readIntOrNull(json['episodeNumber']),
        schemaVersion: readInt(json['schemaVersion'], currentSchemaVersion),
      );

  static const int currentSchemaVersion = 1;

  final String id;
  final String title;
  final String contentLanguage;
  final AspectOption aspect;

  /// The aspect ratio locks after the first picture; duplicate the project to change it.
  final bool aspectLocked;
  final StyleId styleId;
  final CaptionStyle captionStyle;
  final int targetLengthS;
  final Brief brief;
  final String scriptText;
  final List<String> sceneIds;
  final List<String> characterIds;
  final String? narratorVoiceId;
  final String? seriesId;
  final int? episodeNumber;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int schemaVersion;

  Project copyWith({
    String? title,
    String? contentLanguage,
    AspectOption? aspect,
    bool? aspectLocked,
    StyleId? styleId,
    CaptionStyle? captionStyle,
    int? targetLengthS,
    Brief? brief,
    String? scriptText,
    List<String>? sceneIds,
    List<String>? characterIds,
    String? narratorVoiceId,
    String? seriesId,
    int? episodeNumber,
    DateTime? updatedAt,
    bool clearSeries = false,
  }) =>
      Project(
        id: id,
        title: title ?? this.title,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        contentLanguage: contentLanguage ?? this.contentLanguage,
        aspect: aspect ?? this.aspect,
        aspectLocked: aspectLocked ?? this.aspectLocked,
        styleId: styleId ?? this.styleId,
        captionStyle: captionStyle ?? this.captionStyle,
        targetLengthS: targetLengthS ?? this.targetLengthS,
        brief: brief ?? this.brief,
        scriptText: scriptText ?? this.scriptText,
        sceneIds: sceneIds ?? this.sceneIds,
        characterIds: characterIds ?? this.characterIds,
        narratorVoiceId: narratorVoiceId ?? this.narratorVoiceId,
        seriesId: clearSeries ? null : (seriesId ?? this.seriesId),
        episodeNumber: clearSeries ? null : (episodeNumber ?? this.episodeNumber),
        schemaVersion: schemaVersion,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'schemaVersion': schemaVersion,
        'id': id,
        'title': title,
        'contentLanguage': contentLanguage,
        'aspect': aspect.name,
        'aspectLocked': aspectLocked,
        'styleId': styleId.wire,
        'captionStyle': captionStyle.name,
        'targetLengthS': targetLengthS,
        'brief': brief.toJson(),
        'scriptText': scriptText,
        'sceneIds': sceneIds,
        'characterIds': characterIds,
        'narratorVoiceId': narratorVoiceId,
        'seriesId': seriesId,
        'episodeNumber': episodeNumber,
        'createdAt': dateToMs(createdAt),
        'updatedAt': dateToMs(updatedAt),
      };

  @override
  bool operator ==(Object other) =>
      other is Project &&
      other.id == id &&
      other.title == title &&
      other.contentLanguage == contentLanguage &&
      other.aspect == aspect &&
      other.aspectLocked == aspectLocked &&
      other.styleId == styleId &&
      other.captionStyle == captionStyle &&
      other.targetLengthS == targetLengthS &&
      other.brief == brief &&
      other.scriptText == scriptText &&
      sameList(other.sceneIds, sceneIds) &&
      sameList(other.characterIds, characterIds) &&
      other.narratorVoiceId == narratorVoiceId &&
      other.seriesId == seriesId &&
      other.episodeNumber == episodeNumber &&
      other.createdAt == createdAt &&
      other.updatedAt == updatedAt &&
      other.schemaVersion == schemaVersion;

  @override
  int get hashCode => Object.hashAll(<Object?>[
        id,
        title,
        contentLanguage,
        aspect,
        aspectLocked,
        styleId,
        captionStyle,
        targetLengthS,
        brief,
        scriptText,
        Object.hashAll(sceneIds),
        Object.hashAll(characterIds),
        narratorVoiceId,
        seriesId,
        episodeNumber,
        createdAt,
        updatedAt,
        schemaVersion,
      ]);
}
