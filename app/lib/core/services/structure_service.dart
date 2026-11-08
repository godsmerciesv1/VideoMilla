import 'package:flutter/foundation.dart';

import '../models/character_profile.dart';
import '../models/project.dart';
import '../models/scene.dart';
import '../models/series.dart';
import '../models/shot.dart';

/// What the structuring step returns: the script turned into characters,
/// scenes and shots (blueprint Section 5.2).
@immutable
class StructureResult {
  const StructureResult({
    required this.characters,
    required this.scenes,
    required this.shots,
    this.title = '',
    this.needsStyleChange = false,
    this.allowedStyles = const <StyleId>[],
    this.charged = 0,
    this.freeRemaining,
  });

  final List<CharacterProfile> characters;
  final List<Scene> scenes;
  final List<Shot> shots;
  final String title;

  /// A child or teen character is planned for a style that does not allow minors.
  /// The user chooses: switch to one of [allowedStyles], or hide those characters.
  final bool needsStyleChange;
  final List<StyleId> allowedStyles;

  /// Credits taken for this call (0 while the project's free analyses last).
  final int charged;

  /// Free analyses and helpers left in this project, when the server says.
  final int? freeRemaining;
}

/// Script to scenes and shots. Implemented once, over the Worker (`POST /structure`).
abstract interface class StructureService {
  /// Throws [AppError]: moderation (nothing charged), credits, busy, invalidOutput, offline.
  Future<StructureResult> structure({
    required String script,
    required String language,
    required StyleId styleId,
    required int targetLengthS,
    required String projectId,
    required String key,
    Brief brief = const Brief(),
    Series? series,
  });
}
