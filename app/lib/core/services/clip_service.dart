import 'dart:typed_data';

import 'package:flutter/foundation.dart';

import '../errors/app_error.dart';
import '../models/clip.dart';

/// One animated clip to make from an approved picture.
@immutable
class ClipRequest {
  const ClipRequest({
    required this.shotId,
    required this.key,
    required this.firstFrame,
    required this.prompt,
    required this.seconds,
    this.lineAudio,
    this.talking = false,
  });

  final String shotId;
  final String key;

  /// The approved keyframe as JPEG: the clip starts from it.
  final Uint8List firstFrame;

  /// Gentle-motion description (the Worker adds the keep-face-and-outfit rules).
  final String prompt;

  /// 3 to 8 seconds. For a talking shot the audio's length decides.
  final int seconds;

  /// The character's line audio, for lip-sync on a talking shot.
  final Uint8List? lineAudio;
  final bool talking;
}

/// An accepted clip job.
@immutable
class ClipJob {
  const ClipJob({required this.key, required this.shotId, required this.credits});

  final String key;
  final String shotId;

  /// Credits reserved for this clip.
  final int credits;
}

/// The state of a clip job.
@immutable
class ClipStatus {
  const ClipStatus({required this.key, required this.state, this.error});

  final String key;
  final ClipState state;
  final AppError? error;
}

/// Animated clips through the Worker's queue (`/clip/submit`, `/clip/status`, `/clip/file`, `/ack`).
abstract interface class ClipGenerator {
  /// Reserves all clips together or none. [n] is the shot count and [k] the animated count,
  /// so the server can re-check the confirmation rules.
  Future<List<ClipJob>> submit(
    List<ClipRequest> requests, {
    required int n,
    required int k,
    bool confirmHigh = false,
    bool confirmAll = false,
  });

  Future<List<ClipStatus>> status(List<String> keys);

  /// Downloads the finished MP4 (resuming a broken download) and returns an opaque media reference.
  Future<String> download(String key);

  /// Tells the server the clip was saved, so it can be deleted early.
  Future<void> ack(String key);
}
