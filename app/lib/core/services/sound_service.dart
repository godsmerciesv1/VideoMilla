import '../models/sound_choice.dart';

/// The background-sound library and the user's own audio (blueprint Section 54).
abstract interface class SoundService {
  /// The track list. Cached; the cache is used offline. Empty if it never loaded.
  Future<List<SoundTrack>> library();

  /// Downloads a track on first use and returns an opaque media reference. Later calls work offline.
  Future<String> fetchTrack(String id, {void Function(double progress)? onProgress});

  /// The media reference of an already downloaded track, or null.
  Future<String?> cachedPath(String id);

  /// Lets the user pick an audio file. The file is read on the device and never uploaded.
  /// Returns a media reference, or null if cancelled.
  Future<String?> pickUserFile();
}
