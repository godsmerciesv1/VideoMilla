import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

/// `child` is under 13, `teen` 13 to 17.
enum AgeBand { child, teen, adult, mid, elder }

extension AgeBandX on AgeBand {
  /// Under 18: allowed only in the four cartoon styles.
  bool get isMinor => this == AgeBand.child || this == AgeBand.teen;
}

/// A character's profile and approved look. Persisted.
@immutable
class CharacterProfile {
  const CharacterProfile({
    required this.id,
    required this.name,
    this.ageBand = AgeBand.adult,
    this.build = '',
    this.hair = '',
    this.skinTone = '',
    this.outfit = '',
    this.signature = '',
    this.expressions = const <String>[],
    this.voiceId,
    this.templateId,
    this.portraitPaths = const <String>[],
    this.referencePaths = const <String>[],
    this.approved = false,
    this.schemaVersion = currentSchemaVersion,
  });

  factory CharacterProfile.fromJson(Map<String, dynamic> json) => CharacterProfile(
        id: requireString(json, 'id', model: 'CharacterProfile'),
        name: readString(json['name']),
        ageBand: enumFromName(AgeBand.values, json['ageBand'], orElse: AgeBand.adult),
        build: readString(json['build']),
        hair: readString(json['hair']),
        skinTone: readString(json['skinTone']),
        outfit: readString(json['outfit']),
        signature: readString(json['signature']),
        expressions: readStringList(json['expressions']),
        voiceId: readStringOrNull(json['voiceId']),
        templateId: readStringOrNull(json['templateId']),
        portraitPaths: readStringList(json['portraitPaths']),
        referencePaths: readStringList(json['referencePaths']),
        approved: readBool(json['approved']),
        schemaVersion: readInt(json['schemaVersion'], currentSchemaVersion),
      );

  static const int currentSchemaVersion = 1;

  final String id;
  final String name;
  final AgeBand ageBand;
  final String build;
  final String hair;

  /// Chosen with an explicit picker, never inferred from the name.
  final String skinTone;
  final String outfit;

  /// A signature item (a scarf, a lantern) that keeps the character recognizable.
  final String signature;
  final List<String> expressions;
  final String? voiceId;
  final String? templateId;

  /// The four approved 448x448 portraits.
  final List<String> portraitPaths;

  /// Up to four of the user's own reference pictures.
  final List<String> referencePaths;
  final bool approved;
  final int schemaVersion;

  bool get isMinor => ageBand.isMinor;
  bool get hasSheet => portraitPaths.length == 4;

  CharacterProfile copyWith({
    String? name,
    AgeBand? ageBand,
    String? build,
    String? hair,
    String? skinTone,
    String? outfit,
    String? signature,
    List<String>? expressions,
    String? voiceId,
    String? templateId,
    List<String>? portraitPaths,
    List<String>? referencePaths,
    bool? approved,
  }) =>
      CharacterProfile(
        id: id,
        name: name ?? this.name,
        ageBand: ageBand ?? this.ageBand,
        build: build ?? this.build,
        hair: hair ?? this.hair,
        skinTone: skinTone ?? this.skinTone,
        outfit: outfit ?? this.outfit,
        signature: signature ?? this.signature,
        expressions: expressions ?? this.expressions,
        voiceId: voiceId ?? this.voiceId,
        templateId: templateId ?? this.templateId,
        portraitPaths: portraitPaths ?? this.portraitPaths,
        referencePaths: referencePaths ?? this.referencePaths,
        approved: approved ?? this.approved,
        schemaVersion: schemaVersion,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'schemaVersion': schemaVersion,
        'id': id,
        'name': name,
        'ageBand': ageBand.name,
        'build': build,
        'hair': hair,
        'skinTone': skinTone,
        'outfit': outfit,
        'signature': signature,
        'expressions': expressions,
        'voiceId': voiceId,
        'templateId': templateId,
        'portraitPaths': portraitPaths,
        'referencePaths': referencePaths,
        'approved': approved,
      };

  @override
  bool operator ==(Object other) =>
      other is CharacterProfile &&
      other.id == id &&
      other.name == name &&
      other.ageBand == ageBand &&
      other.build == build &&
      other.hair == hair &&
      other.skinTone == skinTone &&
      other.outfit == outfit &&
      other.signature == signature &&
      sameList(other.expressions, expressions) &&
      other.voiceId == voiceId &&
      other.templateId == templateId &&
      sameList(other.portraitPaths, portraitPaths) &&
      sameList(other.referencePaths, referencePaths) &&
      other.approved == approved &&
      other.schemaVersion == schemaVersion;

  @override
  int get hashCode => Object.hashAll(<Object?>[
        id,
        name,
        ageBand,
        build,
        hair,
        skinTone,
        outfit,
        signature,
        Object.hashAll(expressions),
        voiceId,
        templateId,
        Object.hashAll(portraitPaths),
        Object.hashAll(referencePaths),
        approved,
        schemaVersion,
      ]);
}
