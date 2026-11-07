import 'package:flutter/painting.dart';

import 'colors.dart';

/// The type ramp. Faces are bundled assets (never a CDN): Inter for chrome and
/// body, Instrument Serif for the wordmark only, JetBrains Mono for codes.
/// Heavier weights than the first draft, for the modern finish (D-035).
@immutable
class AppText {
  const AppText._({
    required this.display,
    required this.headline,
    required this.title1,
    required this.title2,
    required this.body,
    required this.callout,
    required this.footnote,
    required this.caption,
    required this.button,
    required this.mono,
    required this.brand,
  });

  final TextStyle display;
  final TextStyle headline;
  final TextStyle title1;
  final TextStyle title2;
  final TextStyle body;
  final TextStyle callout;
  final TextStyle footnote;
  final TextStyle caption;

  /// Button and chip labels (chrome face, semibold).
  final TextStyle button;

  /// The 6-digit sign-in code and the referral code.
  final TextStyle mono;

  /// The wordmark. Used once, on Home.
  final TextStyle brand;

  static const String chromeFamily = 'Inter';
  static const String brandFamily = 'InstrumentSerif';
  static const String monoFamily = 'JetBrainsMono';

  /// Per-script faces tried when Inter has no glyph (Section 20.2).
  static const List<String> scriptFallback = <String>[
    'NotoSansDevanagari',
    'NotoSansThai',
    'NotoSansArabic',
    'NotoSansHebrew',
    'NotoSansBengali',
    'NotoSansJP',
    'NotoSansKR',
    'NotoSansTC',
    'NotoNastaliqUrdu',
  ];

  static TextStyle _style(
    double size,
    FontWeight weight,
    double lineHeight,
    Color color, {
    String family = chromeFamily,
    double letterSpacing = 0,
  }) {
    return TextStyle(
      fontFamily: family,
      fontFamilyFallback: scriptFallback,
      fontSize: size,
      fontWeight: weight,
      height: lineHeight,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  /// Builds the ramp for one colour set. Sizes (size / weight / line height):
  /// Display 34/800/1.1, Headline 28/700/1.2, Title 1 22/700/1.3,
  /// Title 2 17/700/1.3, Body 17/400/1.5, Callout 16/500/1.4,
  /// Footnote 13/500/1.4, Caption 12/500/1.3.
  factory AppText.forColors(AppColors c) {
    return AppText._(
      display: _style(34, FontWeight.w800, 1.1, c.textPrimary, letterSpacing: -0.9),
      headline: _style(28, FontWeight.w700, 1.2, c.textPrimary, letterSpacing: -0.6),
      title1: _style(22, FontWeight.w700, 1.3, c.textPrimary, letterSpacing: -0.3),
      title2: _style(17, FontWeight.w700, 1.3, c.textPrimary, letterSpacing: -0.2),
      body: _style(17, FontWeight.w400, 1.5, c.textPrimary),
      callout: _style(16, FontWeight.w500, 1.4, c.textSecondary),
      footnote: _style(13, FontWeight.w500, 1.4, c.textTertiary),
      caption: _style(12, FontWeight.w500, 1.3, c.textTertiary),
      button: _style(17, FontWeight.w600, 1.2, c.accentInk, letterSpacing: -0.1),
      mono: _style(28, FontWeight.w600, 1.2, c.textPrimary, family: monoFamily, letterSpacing: 2),
      brand: TextStyle(
        fontFamily: brandFamily,
        fontSize: 34,
        fontWeight: FontWeight.w400,
        height: 1.1,
        color: c.textPrimary,
        letterSpacing: -0.4,
      ),
    );
  }
}
