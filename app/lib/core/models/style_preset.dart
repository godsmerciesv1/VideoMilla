import 'package:flutter/foundation.dart';

import 'json_helpers.dart';
import 'project.dart';

/// The uniform colour grade applied to a style (tuned at gate G2).
/// Neutral values leave the picture unchanged.
@immutable
class ColorGrade {
  const ColorGrade({this.hue = 0, this.saturation = 1, this.contrast = 1, this.tint});

  factory ColorGrade.fromJson(Map<String, dynamic> json) => ColorGrade(
        hue: readDouble(json['hue']),
        saturation: readDouble(json['saturation'], 1),
        contrast: readDouble(json['contrast'], 1),
        tint: readStringOrNull(json['tint']),
      );

  /// Degrees of hue rotation.
  final double hue;

  /// Multiplier: 1 is unchanged.
  final double saturation;

  /// Multiplier: 1 is unchanged.
  final double contrast;

  /// Optional tint as `#RRGGBB`.
  final String? tint;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'hue': hue,
        'saturation': saturation,
        'contrast': contrast,
        'tint': tint,
      };

  @override
  bool operator ==(Object other) =>
      other is ColorGrade &&
      other.hue == hue &&
      other.saturation == saturation &&
      other.contrast == contrast &&
      other.tint == tint;

  @override
  int get hashCode => Object.hash(hue, saturation, contrast, tint);
}

/// One of the eight styles (blueprint Section 5.3). Read from `styles.json`.
@immutable
class StylePreset {
  const StylePreset({
    required this.id,
    required this.name,
    required this.styleText,
    this.palette = const <String>[],
    this.grade = const ColorGrade(),
    this.anchorAsset = '',
    this.allowsMinors = false,
    this.peopleAllowed = true,
  });

  factory StylePreset.fromJson(Map<String, dynamic> json) => StylePreset(
        id: styleIdFromWire(requireString(json, 'id', model: 'StylePreset')),
        name: readString(json['name']),
        styleText: readString(json['styleText']),
        palette: readStringList(json['palette']),
        grade: ColorGrade.fromJson(readMap(json['grade'])),
        anchorAsset: readString(json['anchorAsset']),
        allowsMinors: readBool(json['allowsMinors']),
        peopleAllowed: readBool(json['peopleAllowed'], true),
      );

  final StyleId id;
  final String name;

  /// English style text added to every picture prompt.
  final String styleText;

  /// Palette as `#RRGGBB` strings.
  final List<String> palette;
  final ColorGrade grade;

  /// Asset path of the 448 px style-anchor image.
  final String anchorAsset;
  final bool allowsMinors;

  /// False only for Realistic Scenes.
  final bool peopleAllowed;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id.wire,
        'name': name,
        'styleText': styleText,
        'palette': palette,
        'grade': grade.toJson(),
        'anchorAsset': anchorAsset,
        'allowsMinors': allowsMinors,
        'peopleAllowed': peopleAllowed,
      };

  @override
  bool operator ==(Object other) =>
      other is StylePreset &&
      other.id == id &&
      other.name == name &&
      other.styleText == styleText &&
      sameList(other.palette, palette) &&
      other.grade == grade &&
      other.anchorAsset == anchorAsset &&
      other.allowsMinors == allowsMinors &&
      other.peopleAllowed == peopleAllowed;

  @override
  int get hashCode => Object.hash(id, name, styleText, Object.hashAll(palette), grade, anchorAsset, allowsMinors, peopleAllowed);
}
