import 'dart:async';

import '../errors/app_error.dart';
import '../models/generation_job.dart';
import '../services/project_store.dart';

/// Does the work of one job (calls a service). Throws [AppError] on failure.
typedef JobRunner = Future<void> Function(GenerationJob job);

/// Waits between automatic retries. Replaceable so tests need no real time.
typedef DelayFn = Future<void> Function(Duration duration);

/// Jobs that share a limit.
enum JobLane { picture, clip, other }

JobLane laneOf(JobKind kind) {
  switch (kind) {
    case JobKind.picture:
    case JobKind.portrait:
      return JobLane.picture;
    case JobKind.clip:
      return JobLane.clip;
    case JobKind.structure:
    case JobKind.assist:
    case JobKind.tts:
    case JobKind.reference:
      return JobLane.other;
  }
}

/// A persistent queue for paid and slow work (blueprint Sections 15 and 34.2).
///
/// * A job is written to the store **before** it runs, so a crash can resume it.
/// * At most 3 picture jobs and 2 clip jobs run at once.
/// * The idempotency key is `<projectId>:<shotId>:<kind>:<attempt>`. Automatic retries and a
///   resume after a crash reuse the same key, so nothing is charged twice. Only an explicit
///   user retry uses the next attempt number.
/// * A retriable failure is retried after 2 seconds, then after 8 seconds; then it is left as
///   `failedRetriable` for the user. Any other failure is `failedTerminal` at once.
class JobQueue {
  JobQueue({
    required ProjectStore store,
    required JobRunner runner,
    DelayFn? delay,
    DateTime Function()? now,
    this.maxPictureJobs = 3,
    this.maxClipJobs = 2,
    this.maxOtherJobs = 3,
  })  : _store = store,
        _runner = runner,
        _delay = delay ?? ((d) => Future<void>.delayed(d)),
        _now = now ?? DateTime.now;

  /// Waits before the first and second automatic retry.
  static const List<Duration> backoff = <Duration>[Duration(seconds: 2), Duration(seconds: 8)];

  final ProjectStore _store;
  final JobRunner _runner;
  final DelayFn _delay;
  final DateTime Function() _now;
  final int maxPictureJobs;
  final int maxClipJobs;
  final int maxOtherJobs;

  final Map<String, GenerationJob> _jobs = <String, GenerationJob>{};
  final Map<String, AppError> _errors = <String, AppError>{};
  final Set<String> _running = <String>{};
  final StreamController<List<GenerationJob>> _updates = StreamController<List<GenerationJob>>.broadcast();
  final List<Completer<void>> _idleWaiters = <Completer<void>>[];

  Stream<List<GenerationJob>> get updates => _updates.stream;

  List<GenerationJob> get jobs => List<GenerationJob>.unmodifiable(_jobs.values);

  /// The last error of a job, for the screen that shows Retry.
  AppError? errorFor(String key) => _errors[key];

  int _limit(JobLane lane) {
    switch (lane) {
      case JobLane.picture:
        return maxPictureJobs;
      case JobLane.clip:
        return maxClipJobs;
      case JobLane.other:
        return maxOtherJobs;
    }
  }

  /// Loads saved jobs after launch and continues unfinished ones with the same keys.
  /// Finished (succeeded) jobs are dropped to keep storage small.
  Future<void> resumePending() async {
    final saved = await _store.loadJobs();
    for (final j in saved) {
      if (j.status == JobStatus.succeeded) continue;
      _jobs[j.key] = j.status == JobStatus.running ? j.copyWith(status: JobStatus.queued) : j;
    }
    await _persist();
    _notify();
    _pump();
  }

  /// Adds a job. A job with the same key that already exists is returned unchanged
  /// (so asking twice never runs twice).
  Future<GenerationJob> enqueue({
    required JobKind kind,
    required String projectId,
    String? shotId,
    int attempt = 0,
  }) async {
    final key = GenerationJob.makeKey(projectId: projectId, shotId: shotId ?? '_', kind: kind, attempt: attempt);
    final existing = _jobs[key];
    if (existing != null) return existing;
    final job = GenerationJob(id: key, kind: kind, key: key, shotId: shotId, createdAt: _now());
    _jobs[key] = job;
    await _persist();
    _notify();
    _pump();
    return job;
  }

  /// Completes when nothing is queued or running.
  Future<void> get idle {
    if (!_hasActive()) return Future<void>.value();
    final c = Completer<void>();
    _idleWaiters.add(c);
    return c.future;
  }

  Future<void> dispose() async {
    await _updates.close();
  }

  bool _hasActive() => _jobs.values.any((j) => j.status == JobStatus.queued || j.status == JobStatus.running);

  void _pump() {
    final queued = _jobs.values.where((j) => j.status == JobStatus.queued).toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    for (final job in queued) {
      final lane = laneOf(job.kind);
      final inLane = _running.where((k) => laneOf(_jobs[k]!.kind) == lane).length;
      if (inLane >= _limit(lane)) continue;
      _running.add(job.key);
      unawaited(_run(job.key));
    }
  }

  Future<void> _set(GenerationJob job) async {
    _jobs[job.key] = job;
    _notify();
    await _persist();
  }

  Future<void> _run(String key) async {
    await _set(_jobs[key]!.copyWith(status: JobStatus.running));
    while (true) {
      final job = _jobs[key]!;
      try {
        await _runner(job);
        _errors.remove(key);
        await _set(job.copyWith(status: JobStatus.succeeded));
        break;
      } on AppError catch (e) {
        _errors[key] = e;
        final canRetry = e.retriable && job.attempts < backoff.length;
        if (!canRetry) {
          await _set(job.copyWith(status: e.retriable ? JobStatus.failedRetriable : JobStatus.failedTerminal));
          break;
        }
        final wait = backoff[job.attempts];
        await _set(job.copyWith(attempts: job.attempts + 1));
        await _delay(wait);
      } catch (_) {
        await _set(job.copyWith(status: JobStatus.failedTerminal));
        break;
      }
    }
    _running.remove(key);
    if (!_hasActive()) {
      for (final c in _idleWaiters) {
        if (!c.isCompleted) c.complete();
      }
      _idleWaiters.clear();
    }
    _pump();
  }

  Future<void> _persist() => _store.saveJobs(_jobs.values.toList());

  void _notify() {
    if (!_updates.isClosed) _updates.add(jobs);
  }
}
