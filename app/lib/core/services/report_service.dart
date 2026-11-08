/// What can be reported.
abstract final class ReportKind {
  static const String picture = 'picture';
  static const String clip = 'clip';
  static const String video = 'video';
  static const String script = 'script';
  static const String translation = 'translation';
}

/// Reports on any output (`POST /report`). A report control is present on every output.
abstract interface class ReportService {
  Future<void> submit(String kind, String ref);
}
