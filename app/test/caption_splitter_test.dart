import 'package:characters/characters.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:videomilla/core/logic/caption_splitter.dart';
import 'package:videomilla/core/models/render_spec.dart';

void expectContiguous(List<Caption> caps, int totalMs) {
  expect(caps.first.startMs, 0);
  for (var i = 1; i < caps.length; i++) {
    expect(caps[i].startMs, caps[i - 1].endMs, reason: 'caption $i must start where the previous one ends');
  }
  expect(caps.last.endMs, totalMs, reason: 'the last caption ends exactly at the audio end');
}

void main() {
  test('empty and blank text give no captions', () {
    expect(splitCaptions('', const Duration(seconds: 2)), isEmpty);
    expect(splitCaptions('   \n ', const Duration(seconds: 2)), isEmpty);
  });

  test('two sentences share the time in proportion', () {
    final caps = splitCaptions('Hello world. How are you?', const Duration(milliseconds: 2000));
    expect(caps.length, 2);
    expect(caps[0].text, 'Hello world.');
    expect(caps[0].endMs, 1000);
    expectContiguous(caps, 2000);
  });

  test('time follows the number of characters', () {
    final caps = splitCaptions('Hi. This is longer.', const Duration(milliseconds: 1800));
    expect(caps[0].endMs, 300);
    expectContiguous(caps, 1800);
  });

  test('rounding never leaves a gap and the last ends at the total', () {
    final caps = splitCaptions('A. B. C.', const Duration(milliseconds: 1000));
    expect(caps.length, 3);
    expectContiguous(caps, 1000);
  });

  test('a decimal point is not a sentence end', () {
    final caps = splitCaptions('Pi is 3.14 today.', const Duration(seconds: 2));
    expect(caps.length, 1);
  });

  test('closing quotes stay with their sentence', () {
    final caps = splitCaptions('She said "go." Then left.', const Duration(seconds: 2));
    expect(caps.length, 2);
    expect(caps[0].text, 'She said "go."');
  });

  test('graphemes, not code units, decide the weight', () {
    // "é." is 2 characters even though it is 3 code units; "ab." is 3.
    final caps = splitCaptions('e\u0301. ab.', const Duration(milliseconds: 500));
    expect(caps.length, 2);
    expect(caps[0].endMs, 200);
  });

  group('sentence marks of other scripts', () {
    test('Japanese and full-width marks', () {
      final caps = splitCaptions('今日は天気がいいです。散歩に行きましょう！', const Duration(seconds: 4), maxCharsPerLine: 16);
      expect(caps.length, 2);
    });
    test('Arabic question mark', () {
      expect(splitCaptions('كيف حالك؟ أنا بخير.', const Duration(seconds: 3)).length, 2);
    });
    test('Devanagari danda', () {
      expect(splitCaptions('यह एक परीक्षा है। यह दूसरा वाक्य है।', const Duration(seconds: 3)).length, 2);
    });
    test('Urdu full stop', () {
      expect(splitCaptions('یہ پہلا جملہ ہے۔ یہ دوسرا ہے۔', const Duration(seconds: 3)).length, 2);
    });
    test('Armenian full stop', () {
      expect(splitCaptions('Սա առաջին նախադասությունն է։ Սա երկրորդն է։', const Duration(seconds: 3)).length, 2);
    });
  });

  group('line limits', () {
    test('no line is longer than the limit and no caption has more than two lines', () {
      final text = List<String>.filled(20, 'abcd').join(' ');
      final caps = splitCaptions(text, const Duration(seconds: 10));
      expect(caps.length, greaterThan(1));
      for (final c in caps) {
        final lines = c.text.split('\n');
        expect(lines.length, lessThanOrEqualTo(2));
        for (final l in lines) {
          expect(l.characters.length, lessThanOrEqualTo(32));
        }
      }
      expectContiguous(caps, 10000);
    });

    test('a 40-character word is cut at the limit', () {
      final caps = splitCaptions('x' * 40, const Duration(seconds: 3));
      for (final c in caps) {
        for (final l in c.text.split('\n')) {
          expect(l.characters.length, lessThanOrEqualTo(32));
        }
      }
      expectContiguous(caps, 3000);
    });

    test('text without spaces is wrapped by characters', () {
      final caps = splitCaptions('あ' * 50, const Duration(seconds: 5), maxCharsPerLine: 16);
      for (final c in caps) {
        for (final l in c.text.split('\n')) {
          expect(l.characters.length, lessThanOrEqualTo(16));
        }
      }
    });

    test('CJK languages use 16 characters, others 32', () {
      expect(maxCharsFor('ja'), 16);
      expect(maxCharsFor('zh_Hant'), 16);
      expect(maxCharsFor('ko'), 16);
      expect(maxCharsFor('en'), 32);
      expect(maxCharsFor('ar'), 32);
    });
  });

  test('every split is contiguous and ends at the total', () {
    const samples = <String>[
      'One.',
      'One two three. Four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen!',
      'No punctuation at all just a long run of words that keeps going and going for a while',
      'Wait... what?! Really?',
    ];
    for (final s in samples) {
      for (final ms in <int>[1, 999, 1234, 60000]) {
        expectContiguous(splitCaptions(s, Duration(milliseconds: ms)), ms);
      }
    }
  });
}
