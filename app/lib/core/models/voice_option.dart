import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum VoiceKind { device, cloud }

/// One voice a character or the narrator can use.
@immutable
class VoiceOption {
  const VoiceOption({
    required this.id,
    required this.kind,
    required this.language,
    this.provider = '',
    this.toneLabel = '',
    this.studio = false,
    this.creditPer9s = 0,
  });

  factory VoiceOption.fromJson(Map<String, dynamic> json) => VoiceOption(
        id: requireString(json, 'id', model: 'VoiceOption'),
        kind: enumFromName(VoiceKind.values, json['kind'], orElse: VoiceKind.cloud),
        language: readString(json['language']),
        provider: readString(json['provider']),
        toneLabel: readString(json['toneLabel']),
        studio: readBool(json['studio']),
        creditPer9s: readInt(json['creditPer9s']),
      );

  final String id;
  final VoiceKind kind;
  final String language;

  /// Internal name of the source (never shown to the user).
  final String provider;

  /// A tone word for the picker, for example warm, bright, deep or soft.
  final String toneLabel;

  /// Studio voices cost credits; standard voices are free.
  final bool studio;

  /// Credits per 9 seconds of video for a studio voice (minimum charge is set in config).
  final int creditPer9s;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'kind': kind.name,
        'language': language,
        'provider': provider,
        'toneLabel': toneLabel,
        'studio': studio,
        'creditPer9s': creditPer9s,
      };

  @override
  bool operator ==(Object other) =>
      other is VoiceOption &&
      other.id == id &&
      other.kind == kind &&
      other.language == language &&
      other.provider == provider &&
      other.toneLabel == toneLabel &&
      other.studio == studio &&
      other.creditPer9s == creditPer9s;

  @override
  int get hashCode => Object.hash(id, kind, language, provider, toneLabel, studio, creditPer9s);
}
