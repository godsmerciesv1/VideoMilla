import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum ScriptKind { idea, script, image }

enum ScriptLineKind { narration, dialogue, direction }

/// One parsed line of a script.
@immutable
class ScriptLine {
  const ScriptLine({required this.kind, required this.text, this.speaker});

  final ScriptLineKind kind;
  final String text;

  /// Set for [ScriptLineKind.dialogue]. May name an unknown character; the
  /// planner decides, and treats an unknown speaker as narration.
  final String? speaker;

  @override
  bool operator ==(Object other) =>
      other is ScriptLine && other.kind == kind && other.text == text && other.speaker == speaker;

  @override
  int get hashCode => Object.hash(kind, text, speaker);
}

/// What the user typed, pasted, imported or picked on the script screen.
@immutable
class ScriptInput {
  const ScriptInput({
    required this.kind,
    this.text = '',
    this.importedFrom,
    this.imageRef,
    this.language = 'en',
  });

  factory ScriptInput.fromJson(Map<String, dynamic> json) => ScriptInput(
        kind: enumFromName(ScriptKind.values, json['kind'], orElse: ScriptKind.idea),
        text: readString(json['text']),
        importedFrom: readStringOrNull(json['importedFrom']),
        imageRef: readStringOrNull(json['imageRef']),
        language: readString(json['language'], 'en'),
      );

  final ScriptKind kind;
  final String text;

  /// File name when the text was imported from a .txt file.
  final String? importedFrom;

  /// Local reference to the picture in image mode.
  final String? imageRef;
  final String language;

  /// Languages written without spaces between words: counted as two characters a word.
  static const Set<String> _unspaced = <String>{'ja', 'zh_Hant', 'th'};

  static final RegExp _speaker =
      RegExp(r"^([\p{L}\p{N}_][\p{L}\p{N}_ .'-]{0,31})\s*[:：]\s*(.+)$", unicode: true);

  /// Words that will be narrated or spoken. Bracketed visual directions are not counted.
  int get wordCount {
    var total = 0;
    for (final line in parse()) {
      if (line.kind != ScriptLineKind.direction) total += _countWords(line.text);
    }
    return total;
  }

  int _countWords(String s) {
    final trimmed = s.trim();
    if (trimmed.isEmpty) return 0;
    if (_unspaced.contains(language)) {
      final chars = trimmed.replaceAll(RegExp(r'\s+'), '').runes.length;
      return (chars / 2).ceil();
    }
    return trimmed.split(RegExp(r'\s+')).length;
  }

  /// Index of the bracket that closes the one at [start], or -1 when unmatched.
  static int _closing(String s, int start) {
    var depth = 0;
    for (var i = start; i < s.length; i++) {
      if (s[i] == '[') depth++;
      if (s[i] == ']') {
        depth--;
        if (depth == 0) return i;
      }
    }
    return -1;
  }

  /// Splits the text into narration, `NAME: line` dialogue and `[visual directions]`.
  List<ScriptLine> parse() {
    final out = <ScriptLine>[];
    for (final raw in text.split(RegExp(r'\r\n|\r|\n'))) {
      final line = raw.trim();
      if (line.isEmpty) continue;
      final spoken = StringBuffer();
      final directions = <String>[];
      var i = 0;
      while (i < line.length) {
        if (line[i] == '[') {
          final end = _closing(line, i);
          if (end > i) {
            directions.add(line.substring(i + 1, end).trim());
            i = end + 1;
            continue;
          }
        }
        spoken.write(line[i]);
        i++;
      }
      for (final d in directions) {
        if (d.isNotEmpty) out.add(ScriptLine(kind: ScriptLineKind.direction, text: d));
      }
      final rest = spoken.toString().replaceAll(RegExp(r'\s{2,}'), ' ').trim();
      if (rest.isEmpty) continue;
      final m = _speaker.firstMatch(rest);
      if (m != null && m.group(1)!.trim().split(' ').length <= 4) {
        out.add(ScriptLine(kind: ScriptLineKind.dialogue, speaker: m.group(1)!.trim(), text: m.group(2)!.trim()));
      } else {
        out.add(ScriptLine(kind: ScriptLineKind.narration, text: rest));
      }
    }
    return out;
  }

  ScriptInput copyWith({
    ScriptKind? kind,
    String? text,
    String? importedFrom,
    String? imageRef,
    String? language,
  }) =>
      ScriptInput(
        kind: kind ?? this.kind,
        text: text ?? this.text,
        importedFrom: importedFrom ?? this.importedFrom,
        imageRef: imageRef ?? this.imageRef,
        language: language ?? this.language,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'kind': kind.name,
        'text': text,
        'importedFrom': importedFrom,
        'imageRef': imageRef,
        'language': language,
      };

  @override
  bool operator ==(Object other) =>
      other is ScriptInput &&
      other.kind == kind &&
      other.text == text &&
      other.importedFrom == importedFrom &&
      other.imageRef == imageRef &&
      other.language == language;

  @override
  int get hashCode => Object.hash(kind, text, importedFrom, imageRef, language);
}
