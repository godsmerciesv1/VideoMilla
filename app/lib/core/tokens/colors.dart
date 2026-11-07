import 'package:flutter/painting.dart';

/// Every colour the app uses. Widgets read these only through `AppTheme`.
/// Values: blueprint Section 20.1 (all text pairs meet 4.5:1) plus the glass
/// and gradient tokens added for the modern finish (docs/decision.md D-035).
@immutable
class AppColors {
  const AppColors({
    required this.bgPrimary,
    required this.bgSecondary,
    required this.bgTertiary,
    required this.accent,
    required this.accentDim,
    required this.accentInk,
    required this.gradA,
    required this.gradB,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.borderSubtle,
    required this.borderFocus,
    required this.error,
    required this.success,
    required this.warning,
    required this.statusPending,
    required this.statusGenerating,
    required this.statusReady,
    required this.statusApproved,
    required this.statusFailed,
    required this.scrim,
    required this.glassFill,
    required this.glassStrong,
    required this.glassBorder,
    required this.glassHighlight,
  });

  final Color bgPrimary;
  final Color bgSecondary;
  final Color bgTertiary;
  final Color accent;
  final Color accentDim;

  /// Label colour on a filled accent surface (white in light, dark ink in dark).
  final Color accentInk;

  /// Gradient pair used on icon tiles and large accents.
  final Color gradA;
  final Color gradB;

  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color borderSubtle;
  final Color borderFocus;
  final Color error;
  final Color success;
  final Color warning;

  /// Domain tokens by meaning. Never colour alone: always an icon and a label.
  final Color statusPending;
  final Color statusGenerating;

  /// A picture that is ready and waits for the user's approval (amber: needs action).
  final Color statusReady;
  final Color statusApproved;
  final Color statusFailed;

  final Color scrim;

  /// Translucent surfaces (sheets, bars, floating controls).
  final Color glassFill;
  final Color glassStrong;
  final Color glassBorder;
  final Color glassHighlight;

  /// Blur radius behind glass surfaces, in logical pixels.
  static const double glassBlur = 26;

  static const AppColors light = AppColors(
    bgPrimary: Color(0xFFF2F2F7),
    bgSecondary: Color(0xFFFFFFFF),
    bgTertiary: Color(0xFFE8E8EE),
    accent: Color(0xFF4338CA),
    accentDim: Color(0xFF372FA8),
    accentInk: Color(0xFFFFFFFF),
    gradA: Color(0xFF4338CA),
    gradB: Color(0xFF9333EA),
    textPrimary: Color(0xFF111114),
    textSecondary: Color(0xFF55555F),
    textTertiary: Color(0xFF62626D),
    borderSubtle: Color(0xFFD8D8E0),
    borderFocus: Color(0xFF4338CA),
    error: Color(0xFFC81E2B),
    success: Color(0xFF15793A),
    warning: Color(0xFF9A5200),
    statusPending: Color(0xFF62626D),
    statusGenerating: Color(0xFF4338CA),
    statusReady: Color(0xFF9A5200),
    statusApproved: Color(0xFF15793A),
    statusFailed: Color(0xFFC81E2B),
    scrim: Color(0x66000000),
    glassFill: Color(0x94FFFFFF),
    glassStrong: Color(0xBDFFFFFF),
    glassBorder: Color(0xBFFFFFFF),
    glassHighlight: Color(0xE6FFFFFF),
  );

  static const AppColors dark = AppColors(
    bgPrimary: Color(0xFF000000),
    bgSecondary: Color(0xFF1C1C1E),
    bgTertiary: Color(0xFF2C2C2E),
    accent: Color(0xFF8F89FF),
    accentDim: Color(0xFF756DF0),
    accentInk: Color(0xFF0B0B14),
    gradA: Color(0xFF8F89FF),
    gradB: Color(0xFFD8B4FE),
    textPrimary: Color(0xFFF5F5F7),
    textSecondary: Color(0xFFA8A8B3),
    textTertiary: Color(0xFF9A9AA5),
    borderSubtle: Color(0xFF38383D),
    borderFocus: Color(0xFF8F89FF),
    error: Color(0xFFFF6B63),
    success: Color(0xFF3DDC84),
    warning: Color(0xFFFFB340),
    statusPending: Color(0xFF9A9AA5),
    statusGenerating: Color(0xFF8F89FF),
    statusReady: Color(0xFFFFB340),
    statusApproved: Color(0xFF3DDC84),
    statusFailed: Color(0xFFFF6B63),
    scrim: Color(0x66000000),
    glassFill: Color(0x852C2C2E),
    glassStrong: Color(0xB31C1C1E),
    glassBorder: Color(0x21FFFFFF),
    glassHighlight: Color(0x24FFFFFF),
  );
}
