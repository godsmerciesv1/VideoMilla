import 'package:flutter/foundation.dart';

import '../models/voice_option.dart';

/// A synthesized voice file. [path] is an opaque media reference that the
/// project store or file service resolves (a file on Android, a stored blob on the web).
@immutable
class VoiceFile {
  const VoiceFile({required this.path, required this.durationMs});

  final String path;
  final int durationMs;
}

/// Narration and character voices. Android: device voice first, then cloud.
/// Web: cloud voices only.
abstract interface class VoiceService {
  Future<VoiceFile> synthesize({
    required String text,
    required String voiceId,
    required String language,
    required bool studio,
    required String key,
  });

  Future<List<VoiceOption>> voices(String language);
}
