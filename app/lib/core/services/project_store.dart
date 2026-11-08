import 'dart:typed_data';

import '../models/character_profile.dart';
import '../models/clip.dart';
import '../models/generation_job.dart';
import '../models/project.dart';
import '../models/scene.dart';
import '../models/series.dart';
import '../models/shot.dart';

/// Local persistence: SQLite and files on Android, IndexedDB on the web.
///
/// Every call is wrapped by the implementation in try/catch with an in-memory
/// fallback; when that fallback is active [degraded] is true and the app shows a
/// warning banner. Every stored record carries a `schemaVersion`; migrations run
/// in [open]; a corrupt record raises `AppError.corrupt`.
abstract interface class ProjectStore {
  /// Opens the store and runs migrations. Never throws for storage trouble:
  /// it switches to the in-memory fallback instead.
  Future<void> open();

  /// True while data is only being kept in memory.
  bool get degraded;

  Future<int> schemaVersion();

  // Projects and their content.
  Future<List<Project>> listProjects();
  Future<Project?> getProject(String id);
  Future<void> saveProject(Project project);

  /// Deletes the project with its scenes, shots, characters, clips and media.
  Future<void> deleteProject(String id);

  Future<List<Scene>> loadScenes(String projectId);
  Future<void> saveScenes(String projectId, List<Scene> scenes);

  Future<List<Shot>> loadShots(String projectId);
  Future<void> saveShot(String projectId, Shot shot);
  Future<void> saveShots(String projectId, List<Shot> shots);
  Future<void> deleteShot(String projectId, String shotId);

  Future<List<CharacterProfile>> loadCharacters(String projectId);
  Future<void> saveCharacters(String projectId, List<CharacterProfile> characters);

  Future<List<Clip>> loadClips(String projectId);
  Future<void> saveClip(String projectId, Clip clip);

  // The persistent job queue (written before a job runs, so a crash can resume it).
  Future<List<GenerationJob>> loadJobs();
  Future<void> saveJobs(List<GenerationJob> jobs);

  // Series live on the device.
  Future<List<Series>> listSeries();
  Future<Series?> getSeries(String id);
  Future<void> saveSeries(Series series);
  Future<void> deleteSeries(String id);

  // Pictures, audio and clips. A media reference is opaque to the caller.
  Future<String> putMedia(String projectId, String name, Uint8List bytes);
  Future<Uint8List?> readMedia(String ref);
  Future<void> deleteMedia(String ref);
  Future<int> mediaBytes(String projectId);

  // Small settings and caches (theme, language, last good config, "welcome shown").
  Future<String?> readMeta(String key);
  Future<void> writeMeta(String key, String value);
}
