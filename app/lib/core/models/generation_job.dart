import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum JobKind { structure, assist, picture, portrait, clip, tts, reference }

enum JobStatus { queued, running, succeeded, failedRetriable, failedTerminal }

/// One unit of paid or slow work held by the persistent job queue.
@immutable
class GenerationJob {
  const GenerationJob({
    required this.id,
    required this.kind,
    required this.key,
    required this.createdAt,
    this.shotId,
    this.status = JobStatus.queued,
    this.attempts = 0,
  });

  factory GenerationJob.fromJson(Map<String, dynamic> json) => GenerationJob(
        id: requireString(json, 'id', model: 'GenerationJob'),
        kind: enumFromName(JobKind.values, json['kind'], orElse: JobKind.picture),
        key: readString(json['key']),
        createdAt: readDate(json['createdAt']),
        shotId: readStringOrNull(json['shotId']),
        status: enumFromName(JobStatus.values, json['status'], orElse: JobStatus.queued),
        attempts: readInt(json['attempts']),
      );

  /// The idempotency key `<projectId>:<shotId>:<kind>:<attempt>` (blueprint Section 34.2).
  /// A job that is resumed after a crash reuses the same key, so it is never charged twice.
  static String makeKey({
    required String projectId,
    required String shotId,
    required JobKind kind,
    required int attempt,
  }) =>
      '$projectId:$shotId:${kind.name}:$attempt';

  final String id;
  final JobKind kind;
  final String key;
  final String? shotId;
  final JobStatus status;
  final int attempts;
  final DateTime createdAt;

  bool get isDone => status == JobStatus.succeeded || status == JobStatus.failedTerminal;

  GenerationJob copyWith({JobStatus? status, int? attempts}) => GenerationJob(
        id: id,
        kind: kind,
        key: key,
        createdAt: createdAt,
        shotId: shotId,
        status: status ?? this.status,
        attempts: attempts ?? this.attempts,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'kind': kind.name,
        'key': key,
        'shotId': shotId,
        'status': status.name,
        'attempts': attempts,
        'createdAt': dateToMs(createdAt),
      };

  @override
  bool operator ==(Object other) =>
      other is GenerationJob &&
      other.id == id &&
      other.kind == kind &&
      other.key == key &&
      other.shotId == shotId &&
      other.status == status &&
      other.attempts == attempts &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(id, kind, key, shotId, status, attempts, createdAt);
}
