import 'package:flutter/foundation.dart';

import '../models/character_profile.dart';
import '../models/generation_job.dart';
import '../models/project.dart';

/// One picture request: a character portrait or a shot keyframe.
/// The Worker assembles the final prompt (blueprint F080); the app sends the pieces.
@immutable
class ImageRequest {
  const ImageRequest({
    required this.prompt,
    required this.styleId,
    required this.width,
    required this.height,
    required this.key,
    required this.projectId,
    this.kind = JobKind.picture,
    this.characters = const <CharacterProfile>[],
    this.references = const <Uint8List>[],
    this.selfMode = false,
  });

  /// What the picture shows (the shot's visual description, or the portrait description).
  final String prompt;
  final StyleId styleId;
  final int width;
  final int height;

  /// Idempotency key: a retry with the same key is never charged twice.
  final String key;
  final String projectId;

  /// [JobKind.picture] for a keyframe, [JobKind.portrait] for a character portrait.
  final JobKind kind;
  final List<CharacterProfile> characters;

  /// Up to four prepared reference pictures (512 px or smaller, no metadata).
  final List<Uint8List> references;

  /// Cartoon Me: the single reference is the user's own face (cartoon styles only).
  final bool selfMode;
}

/// Result of the reference-picture check.
@immutable
class ReferenceVerdict {
  const ReferenceVerdict({required this.face, required this.ok, this.faceCount});

  /// A human face was found.
  final bool face;

  /// The picture may be used (for a normal reference: no face; for Cartoon Me: exactly one face).
  final bool ok;
  final int? faceCount;
}

/// Pictures and reference checks, over the Worker (`POST /image`, `POST /reference/check`).
abstract interface class ImageService {
  /// Returns the picture bytes. Throws [AppError]: moderation, credits, busy, offline.
  Future<Uint8List> generate(ImageRequest request);

  /// Fails closed: if the check cannot run, the picture is refused.
  Future<ReferenceVerdict> checkReference(Uint8List jpeg, {bool selfMode = false});
}
