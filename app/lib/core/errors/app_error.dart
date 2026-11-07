import 'package:flutter/foundation.dart';

/// The kinds of failure the app distinguishes (blueprint Section 15).
enum ErrorKind {
  offline,
  busy,
  moderation,
  credits,
  invalidOutput,
  clip,
  lipSync,
  render,
  storage,
  persistence,
  corrupt,
  badCode,
  session,
  browser,
}

/// The one type every service throws and every provider catches.
/// `messageKey` names a localized string; nothing user-facing is hard-coded.
@immutable
class AppError implements Exception {
  const AppError(
    this.kind, {
    required this.messageKey,
    this.retriable = false,
    this.userCaused = false,
    this.detail,
  });

  /// Offline or a network failure. Recoverable and retriable.
  const AppError.offline({String? detail})
      : this(ErrorKind.offline, messageKey: 'errorOffline', retriable: true, detail: detail);

  /// A provider is busy or a daily cap was reached. Nothing is charged.
  const AppError.busy({String? detail})
      : this(ErrorKind.busy, messageKey: 'errorBusy', retriable: true, detail: detail);

  /// A safety check blocked the input. Nothing is charged.
  const AppError.moderation({String? detail})
      : this(ErrorKind.moderation, messageKey: 'errorModeration', userCaused: true, detail: detail);

  const AppError.insufficientCredits({String? detail})
      : this(ErrorKind.credits, messageKey: 'errorCredits', userCaused: true, detail: detail);

  /// The model's answer failed validation. Retried twice, then terminal.
  const AppError.invalidOutput({bool retriable = true, String? detail})
      : this(ErrorKind.invalidOutput, messageKey: 'errorInvalidOutput', retriable: retriable, detail: detail);

  const AppError.clipFailed({String? detail})
      : this(ErrorKind.clip, messageKey: 'errorClipFailed', retriable: true, detail: detail);

  const AppError.lipSyncFailed({String? detail})
      : this(ErrorKind.lipSync, messageKey: 'errorLipSyncFailed', detail: detail);

  const AppError.renderFailed({String? detail})
      : this(ErrorKind.render, messageKey: 'errorRenderFailed', detail: detail);

  const AppError.storageFull({String? detail})
      : this(ErrorKind.storage, messageKey: 'errorStorageFull', userCaused: true, detail: detail);

  const AppError.persistence({String? detail})
      : this(ErrorKind.persistence, messageKey: 'errorPersistence', detail: detail);

  const AppError.corrupt({String? detail})
      : this(ErrorKind.corrupt, messageKey: 'errorCorrupt', detail: detail);

  const AppError.badCode({String? detail})
      : this(ErrorKind.badCode, messageKey: 'errorBadCode', userCaused: true, detail: detail);

  /// This device was signed in and the server no longer accepts it.
  const AppError.sessionEnded({String? detail})
      : this(ErrorKind.session, messageKey: 'errorSession', userCaused: true, detail: detail);

  const AppError.unsupportedBrowser({String? detail})
      : this(ErrorKind.browser, messageKey: 'errorUnsupportedBrowser', detail: detail);

  final ErrorKind kind;

  /// Key of the localized message in the ARB files.
  final String messageKey;

  /// A retry can succeed.
  final bool retriable;

  /// The user can fix it (edit the script, buy credits, free space).
  final bool userCaused;

  /// Technical detail for logs and reports. Never shown to the user.
  final String? detail;

  /// Stable short code, for reports and tests.
  String get code => kind.name;

  @override
  bool operator ==(Object other) =>
      other is AppError &&
      other.kind == kind &&
      other.messageKey == messageKey &&
      other.retriable == retriable &&
      other.userCaused == userCaused &&
      other.detail == detail;

  @override
  int get hashCode => Object.hash(kind, messageKey, retriable, userCaused, detail);

  @override
  String toString() => 'AppError($code${detail == null ? '' : ': $detail'})';
}
