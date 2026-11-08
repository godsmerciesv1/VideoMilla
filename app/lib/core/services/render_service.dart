import 'package:flutter/foundation.dart';

import '../models/project.dart';
import '../models/render_spec.dart';
import '../models/shot.dart';

enum RenderPhase { preparing, encoding, joining }

/// Progress of a render.
@immutable
class RenderProgress {
  const RenderProgress({required this.fraction, this.phase = RenderPhase.encoding, this.segmentsDone = 0});

  /// 0 to 1.
  final double fraction;
  final RenderPhase phase;

  /// Checkpoint units finished so far (a restart resumes at the first unfinished one).
  final int segmentsDone;
}

@immutable
class RenderResult {
  const RenderResult({required this.path, required this.durationMs});

  /// Opaque media reference of the finished MP4.
  final String path;
  final int durationMs;
}

/// Whether this device or browser can render at all.
enum RenderSupport { supported, noEncoder, noWebCodecs }

/// Renders a [RenderSpec] to an MP4. Android: Media3 Transformer. Web: WebCodecs.
abstract interface class RenderService {
  /// Checked before offering Render. When unsupported, the app offers the image-and-audio export.
  Future<RenderSupport> probe();

  /// Throws [AppError.renderFailed] on failure. [resumeFrom] is the first unfinished checkpoint.
  Future<RenderResult> render(
    RenderSpec spec, {
    void Function(RenderProgress progress)? onProgress,
    int resumeFrom = 0,
  });

  Future<void> cancel();
}

/// Keeps a render alive while the app is in the background (Android foreground
/// service, web wake lock).
abstract interface class RenderHost {
  Future<void> keepAlive();
  Future<void> release();

  /// Fires when the system ends the background work (Android 15 timeout). Progress is already checkpointed.
  Stream<void> get timeouts;
}

/// Files the user can see: save, share, free space, export.
abstract interface class FileService {
  /// Free space on the device or the browser's storage quota, in bytes.
  Future<int> freeBytes();

  /// Bytes used by one project (for the storage screen).
  Future<int> projectBytes(String projectId);

  /// Saves an MP4 to the gallery (Android) or downloads it (web). Returns a display name.
  Future<String> saveToGallery(String mediaPath);

  /// Opens the share sheet (Android) or the Web Share API when it accepts files.
  Future<void> share(String mediaPath, {String? mimeType});

  Future<void> deleteProject(String projectId);

  /// Fallback when rendering is impossible or fails: approved pictures and audio as one archive.
  /// Returns an opaque media reference of the archive.
  Future<String> exportFallback(Project project, List<Shot> shots);
}
