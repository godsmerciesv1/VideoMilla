import 'app_error.dart';

/// How an error is shown (blueprint Section 15).
enum Treatment {
  /// A banner with Retry, content stays usable.
  banner,

  /// A bottom sheet that explains and offers the fix.
  sheet,

  /// A full screen (the failed thing cannot continue).
  screen,

  /// Retried automatically without telling the user (until it stops being retriable).
  silentRetry,
}

/// Decides the UI treatment of every error. The switch is exhaustive, so a new
/// [ErrorKind] cannot be added without choosing its treatment.
Treatment treatmentFor(AppError error) {
  switch (error.kind) {
    case ErrorKind.offline:
    case ErrorKind.busy:
    case ErrorKind.clip:
    case ErrorKind.lipSync:
    case ErrorKind.persistence:
    case ErrorKind.badCode:
      return Treatment.banner;
    case ErrorKind.moderation:
    case ErrorKind.credits:
    case ErrorKind.session:
      return Treatment.sheet;
    case ErrorKind.invalidOutput:
      // Two automatic retries, then the user is told to edit the script.
      return error.retriable ? Treatment.silentRetry : Treatment.sheet;
    case ErrorKind.render:
    case ErrorKind.storage:
    case ErrorKind.corrupt:
    case ErrorKind.browser:
      return Treatment.screen;
  }
}
