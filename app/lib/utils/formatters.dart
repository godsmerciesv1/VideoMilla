import 'package:intl/intl.dart';

/// One formatting path for every number the user sees.

/// `1:05` for 65 seconds, `1:02:03` for an hour or more.
String formatDuration(Duration d) {
  final total = d.inSeconds < 0 ? 0 : d.inSeconds;
  final h = total ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = total % 60;
  String two(int n) => n.toString().padLeft(2, '0');
  return h > 0 ? '$h:${two(m)}:${two(s)}' : '$m:${two(s)}';
}

/// `512 B`, `1.5 KB`, `38.2 MB`, `1.1 GB` (base 1024), digits follow [locale].
String formatFileSize(int bytes, {String? locale}) {
  const units = <String>['B', 'KB', 'MB', 'GB', 'TB'];
  var value = bytes < 0 ? 0.0 : bytes.toDouble();
  var unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  if (unit == 0) return '${value.toInt()} ${units[0]}';
  final f = NumberFormat.decimalPatternDigits(locale: locale, decimalDigits: 1);
  return '${f.format(value)} ${units[unit]}';
}

/// A whole number with the locale's grouping, for example `1,250`.
/// The word "credits" comes from the localized plural string, not from here.
String formatCreditsNumber(int credits, {String? locale}) =>
    NumberFormat.decimalPattern(locale).format(credits);

/// A short date in the locale, for example `Nov 6, 2026`.
String formatDate(DateTime date, {String? locale}) => DateFormat.yMMMd(locale).format(date);
