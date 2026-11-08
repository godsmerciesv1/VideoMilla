import 'package:characters/characters.dart';

import '../models/render_spec.dart';

/// Characters that end a sentence in the scripts the app supports: Latin, Cyrillic,
/// Greek (`.` `!` `?` `…`), CJK (`。！？`), Arabic and Urdu (`؟` `۔`), Armenian (`։`),
/// Devanagari and Bengali (`।` `॥`), Ethiopic (`።`).
const Set<String> _terminators = <String>{'.', '!', '?', '…', '。', '！', '？', '؟', '۔', '։', '।', '॥', '።'};

/// Closing marks that stay attached to the sentence they close.
const Set<String> _closers = <String>{'"', "'", '”', '’', '»', '」', '』', ')', ']', '）'};

/// Maximum characters on one caption line: 16 for CJK scripts, 32 otherwise.
int maxCharsFor(String language) => (language == 'ja' || language == 'zh_Hant' || language == 'ko') ? 16 : 32;

bool _isDigit(String g) => g.length == 1 && g.codeUnitAt(0) >= 0x30 && g.codeUnitAt(0) <= 0x39;

/// Splits [text] into sentences, keeping the terminators. A full stop between two
/// digits (3.14) is not a sentence end.
List<String> _sentences(String text) {
  final g = text.characters.toList();
  final out = <String>[];
  final buf = StringBuffer();
  var i = 0;
  while (i < g.length) {
    final c = g[i];
    buf.write(c);
    i++;
    if (_terminators.contains(c)) {
      if (c == '.' && i - 2 >= 0 && _isDigit(g[i - 2]) && i < g.length && _isDigit(g[i])) continue;
      while (i < g.length && (_terminators.contains(g[i]) || _closers.contains(g[i]))) {
        buf.write(g[i]);
        i++;
      }
      final s = buf.toString().trim();
      if (s.isNotEmpty) out.add(s);
      buf.clear();
    }
  }
  final rest = buf.toString().trim();
  if (rest.isNotEmpty) out.add(rest);
  return out;
}

/// Wraps a sentence into lines of at most [max] characters, breaking at spaces when
/// there are any and inside a word only when a word is longer than a line.
List<String> _wrap(String sentence, int max) {
  final lines = <String>[];
  var current = '';
  void flush() {
    if (current.isNotEmpty) lines.add(current);
    current = '';
  }

  for (final word in sentence.split(RegExp(r'\s+'))) {
    if (word.isEmpty) continue;
    var w = word;
    while (w.characters.length > max) {
      if (current.isNotEmpty) flush();
      lines.add(w.characters.take(max).toString());
      w = w.characters.skip(max).toString();
    }
    if (w.isEmpty) continue;
    final joined = current.isEmpty ? w : '$current $w';
    if (joined.characters.length <= max) {
      current = joined;
    } else {
      flush();
      current = w;
    }
  }
  flush();
  return lines;
}

int _weight(String caption) => caption.replaceAll('\n', '').characters.length;

/// Splits [text] into timed captions that cover [total] exactly.
///
/// * Sentences end at the marks above, in every script.
/// * A caption has at most two lines of [maxCharsPerLine] characters (16 for CJK, 32 otherwise);
///   a longer sentence becomes several captions.
/// * Time is proportional to the number of user-perceived characters (graphemes), never code units.
/// * Captions are contiguous, and the last one ends exactly at [total].
List<Caption> splitCaptions(String text, Duration total, {int maxCharsPerLine = 32}) {
  final pieces = <String>[];
  for (final sentence in _sentences(text)) {
    final lines = _wrap(sentence, maxCharsPerLine);
    for (var i = 0; i < lines.length; i += 2) {
      pieces.add(i + 1 < lines.length ? '${lines[i]}\n${lines[i + 1]}' : lines[i]);
    }
  }
  if (pieces.isEmpty) return const <Caption>[];

  final totalMs = total.inMilliseconds;
  final weights = <int>[for (final p in pieces) _weight(p)];
  final sum = weights.fold<int>(0, (a, b) => a + b);
  final out = <Caption>[];
  var acc = 0;
  var start = 0;
  for (var i = 0; i < pieces.length; i++) {
    acc += weights[i];
    final end = i == pieces.length - 1 ? totalMs : (totalMs * acc / sum).round();
    out.add(Caption(startMs: start, endMs: end, text: pieces[i]));
    start = end;
  }
  return out;
}
