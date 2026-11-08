import 'package:flutter/foundation.dart';

import '../models/character_profile.dart';
import '../models/project.dart';

/// The AI's answer plus what it cost: the first three helper calls per project
/// are free, shared with Analyze (blueprint Section 7).
@immutable
class AssistResult<T> {
  const AssistResult({required this.value, this.charged = 0, this.freeRemaining});

  final T value;
  final int charged;
  final int? freeRemaining;
}

/// One brainstormed idea: a title and one line.
@immutable
class IdeaSuggestion {
  const IdeaSuggestion({required this.title, required this.line});

  final String title;
  final String line;
}

enum ScriptImprovement { expand, fitLength, changeTone, simplify }

/// Idea brainstorm, script improver, character builder and the series summary (`POST /assist`).
abstract interface class AssistService {
  /// Five ideas.
  Future<AssistResult<List<IdeaSuggestion>>> ideas(
    Brief brief, {
    required String language,
    required String projectId,
    required String key,
  });

  Future<AssistResult<String>> improveScript({
    required String script,
    required ScriptImprovement mode,
    required String language,
    required String projectId,
    required String key,
    int? targetLengthS,
    String? tone,
  });

  /// A sentence becomes a full profile.
  Future<AssistResult<CharacterProfile>> buildCharacter(
    String sentence, {
    required String language,
    required StyleId styleId,
    required String projectId,
    required String key,
  });

  /// Updates the series' running summary after an episode (free).
  Future<AssistResult<String>> updateSummary({
    required String previousSummary,
    required String episodeScript,
    required String language,
    required String key,
  });
}
