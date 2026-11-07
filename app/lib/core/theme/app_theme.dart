import 'package:flutter/widgets.dart';

import '../tokens/colors.dart';
import '../tokens/radii.dart';
import '../tokens/spacing.dart';
import '../tokens/typography.dart';

/// All design tokens for one brightness. There is no Material `ThemeData`:
/// widgets call `AppTheme.of(context)`.
@immutable
class AppTheme {
  const AppTheme({
    required this.brightness,
    required this.colors,
    required this.text,
    required this.space,
    required this.radii,
  });

  final Brightness brightness;
  final AppColors colors;
  final AppText text;
  final AppSpace space;
  final AppRadii radii;

  bool get isDark => brightness == Brightness.dark;

  static AppTheme of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppThemeScope>();
    assert(scope != null, 'AppThemeScope is missing above this widget.');
    return scope!.theme;
  }

  /// Builds the theme for a brightness from the colour tokens.
  static AppTheme build(Brightness brightness) {
    final colors = brightness == Brightness.dark ? AppColors.dark : AppColors.light;
    return AppTheme(
      brightness: brightness,
      colors: colors,
      text: AppText.forColors(colors),
      space: const AppSpace(),
      radii: const AppRadii(),
    );
  }
}

/// Makes the theme available to the whole widget tree.
class AppThemeScope extends InheritedWidget {
  const AppThemeScope({super.key, required this.theme, required super.child});

  final AppTheme theme;

  @override
  bool updateShouldNotify(AppThemeScope oldWidget) => theme != oldWidget.theme;
}

/// `buildTheme(colors, brightness)` of the blueprint, kept as one call.
AppTheme buildTheme(Brightness brightness) => AppTheme.build(brightness);

/// Reduce Motion: every animation becomes an instant change.
Duration motionDuration(BuildContext context, Duration normal) {
  return MediaQuery.disableAnimationsOf(context) ? Duration.zero : normal;
}
