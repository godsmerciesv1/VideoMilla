import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:videomilla/core/errors/app_error.dart';
import 'package:videomilla/core/logic/job_queue.dart';
import 'package:videomilla/core/models/generation_job.dart';
import 'package:videomilla/core/services/project_store.dart';

/// Only the job storage is real; every other call fails loudly.
class FakeStore implements ProjectStore {
  List<GenerationJob> saved = <GenerationJob>[];
  List<GenerationJob> toLoad = <GenerationJob>[];

  @override
  Future<List<GenerationJob>> loadJobs() async => toLoad;

  @override
  Future<void> saveJobs(List<GenerationJob> jobs) async {
    saved = List<GenerationJob>.of(jobs);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

String keyFor(String shot, JobKind kind, {int attempt = 0}) =>
    GenerationJob.makeKey(projectId: 'proj-1', shotId: shot, kind: kind, attempt: attempt);

JobStatus statusOf(JobQueue q, String key) => q.jobs.firstWhere((j) => j.key == key).status;

void main() {
  test('the key is projectId:shotId:kind:attempt', () {
    expect(keyFor('s1', JobKind.picture), 'proj-1:s1:picture:0');
    expect(keyFor('s1', JobKind.clip, attempt: 2), 'proj-1:s1:clip:2');
  });

  test('a job is saved as running before it runs', () async {
    final store = FakeStore();
    JobStatus? seen;
    final q = JobQueue(
      store: store,
      runner: (job) async {
        seen = store.saved.firstWhere((j) => j.key == job.key).status;
      },
      delay: (d) async {},
    );
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    await q.idle;
    expect(seen, JobStatus.running);
    expect(statusOf(q, keyFor('s1', JobKind.picture)), JobStatus.succeeded);
  });

  test('at most 3 picture jobs run at once', () async {
    var active = 0;
    var peak = 0;
    final release = Completer<void>();
    final q = JobQueue(
      store: FakeStore(),
      runner: (job) async {
        active++;
        peak = math.max(peak, active);
        await release.future;
        active--;
      },
      delay: (d) async {},
    );
    for (var i = 0; i < 5; i++) {
      await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's$i');
    }
    await pumpEventQueue();
    expect(active, 3);
    release.complete();
    await q.idle;
    expect(peak, 3);
    expect(q.jobs.every((j) => j.status == JobStatus.succeeded), isTrue);
  });

  test('portraits share the picture limit', () async {
    var active = 0;
    var peak = 0;
    final release = Completer<void>();
    final q = JobQueue(
      store: FakeStore(),
      runner: (job) async {
        active++;
        peak = math.max(peak, active);
        await release.future;
        active--;
      },
      delay: (d) async {},
    );
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 'a');
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 'b');
    await q.enqueue(kind: JobKind.portrait, projectId: 'proj-1', shotId: 'c');
    await q.enqueue(kind: JobKind.portrait, projectId: 'proj-1', shotId: 'd');
    await pumpEventQueue();
    expect(active, 3);
    release.complete();
    await q.idle;
    expect(peak, 3);
  });

  test('at most 2 clip jobs run at once, independent of pictures', () async {
    final running = <JobKind>[];
    final release = Completer<void>();
    final q = JobQueue(
      store: FakeStore(),
      runner: (job) async {
        running.add(job.kind);
        await release.future;
      },
      delay: (d) async {},
    );
    for (var i = 0; i < 4; i++) {
      await q.enqueue(kind: JobKind.clip, projectId: 'proj-1', shotId: 'c$i');
    }
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 'p0');
    await pumpEventQueue();
    expect(running.where((k) => k == JobKind.clip).length, 2);
    expect(running.where((k) => k == JobKind.picture).length, 1);
    release.complete();
    await q.idle;
  });

  test('a retriable failure is retried after 2 s then 8 s with the same key', () async {
    final delays = <Duration>[];
    final keys = <String>[];
    var calls = 0;
    final q = JobQueue(
      store: FakeStore(),
      runner: (job) async {
        keys.add(job.key);
        calls++;
        if (calls < 3) throw const AppError.offline();
      },
      delay: (d) async {
        delays.add(d);
      },
    );
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    await q.idle;
    expect(calls, 3);
    expect(delays, const <Duration>[Duration(seconds: 2), Duration(seconds: 8)]);
    expect(keys.toSet().length, 1, reason: 'automatic retries reuse the key so nothing is charged twice');
    final job = q.jobs.single;
    expect(job.status, JobStatus.succeeded);
    expect(job.attempts, 2);
  });

  test('after the retries it is left for the user as failedRetriable', () async {
    var calls = 0;
    final q = JobQueue(
      store: FakeStore(),
      runner: (job) async {
        calls++;
        throw const AppError.busy();
      },
      delay: (d) async {},
    );
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    await q.idle;
    expect(calls, 3);
    final key = keyFor('s1', JobKind.picture);
    expect(statusOf(q, key), JobStatus.failedRetriable);
    expect(q.errorFor(key)!.kind, ErrorKind.busy);
  });

  test('a non-retriable failure stops at once', () async {
    var calls = 0;
    final delays = <Duration>[];
    final q = JobQueue(
      store: FakeStore(),
      runner: (job) async {
        calls++;
        throw const AppError.moderation();
      },
      delay: (d) async {
        delays.add(d);
      },
    );
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    await q.idle;
    expect(calls, 1);
    expect(delays, isEmpty);
    expect(statusOf(q, keyFor('s1', JobKind.picture)), JobStatus.failedTerminal);
  });

  test('an unexpected error is terminal', () async {
    final q = JobQueue(store: FakeStore(), runner: (job) async => throw StateError('boom'), delay: (d) async {});
    await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    await q.idle;
    expect(q.jobs.single.status, JobStatus.failedTerminal);
  });

  test('asking twice for the same key runs the job once', () async {
    var calls = 0;
    final q = JobQueue(store: FakeStore(), runner: (job) async {
      calls++;
    }, delay: (d) async {});
    final a = await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    final b = await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    await q.idle;
    expect(a.key, b.key);
    expect(calls, 1);
    expect(q.jobs.length, 1);
  });

  test('a user retry uses the next attempt number, so it is a new paid request', () async {
    final q = JobQueue(store: FakeStore(), runner: (job) async {}, delay: (d) async {});
    final first = await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1');
    final second = await q.enqueue(kind: JobKind.picture, projectId: 'proj-1', shotId: 's1', attempt: 1);
    await q.idle;
    expect(first.key, isNot(second.key));
    expect(q.jobs.length, 2);
  });

  test('after a crash, unfinished jobs resume with the same key and finished ones are dropped', () async {
    final store = FakeStore();
    final created = DateTime.utc(2026, 11, 7);
    final runningKey = keyFor('s1', JobKind.picture);
    final doneKey = keyFor('s2', JobKind.picture);
    store.toLoad = <GenerationJob>[
      GenerationJob(id: runningKey, kind: JobKind.picture, key: runningKey, createdAt: created, shotId: 's1', status: JobStatus.running),
      GenerationJob(id: doneKey, kind: JobKind.picture, key: doneKey, createdAt: created, shotId: 's2', status: JobStatus.succeeded),
    ];
    final ran = <String>[];
    final q = JobQueue(store: store, runner: (job) async {
      ran.add(job.key);
    }, delay: (d) async {});
    await q.resumePending();
    await q.idle;
    expect(ran, <String>[runningKey]);
    expect(q.jobs.length, 1);
    expect(q.jobs.single.status, JobStatus.succeeded);
  });

  test('updates are announced', () async {
    final q = JobQueue(store: FakeStore(), runner: (job) async {}, delay: (d) async {});
    var announcements = 0;
    final sub = q.updates.listen((_) => announcements++);
    await q.enqueue(kind: JobKind.tts, projectId: 'proj-1', shotId: 's1');
    await q.idle;
    await pumpEventQueue();
    expect(announcements, greaterThan(1));
    await sub.cancel();
    await q.dispose();
  });
}
