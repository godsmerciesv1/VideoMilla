import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../core/tokens/colors.dart';
import '../core/tokens/typography.dart';

/// Hooks every uncaught error so nobody ever sees a raw grey screen.
///
/// The fallback view is built from tokens only and carries its own English
/// text: when it appears, localization may be the thing that failed.
abstract final class GlobalErrorHandler {
  /// Called with every uncaught error (reporting is wired in `main.dart`).
  static void Function(Object error, StackTrace? stack)? onReport;

  /// Called when the user taps "Try again" on the fallback screen.
  static VoidCallback? onRetry;

  static void install() {
    FlutterError.onError = (FlutterErrorDetails details) {
      FlutterError.presentError(details);
      onReport?.call(details.exception, details.stack);
    };
    PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
      debugPrint('Uncaught error: $error');
      onReport?.call(error, stack);
      return true;
    };
    ErrorWidget.builder = (FlutterErrorDetails details) => const _FallbackErrorView();
  }
}

class _FallbackErrorView extends StatelessWidget {
  const _FallbackErrorView();

  @override
  Widget build(BuildContext context) {
    const colors = AppColors.light;
    final text = AppText.forColors(colors);
    return Directionality(
      textDirection: TextDirection.ltr,
      child: ColoredBox(
        color: colors.bgPrimary,
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text('Something went wrong', style: text.title1, textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  Text(
                    'Please try again. If it keeps happening, tell us from the report button.',
                    style: text.callout,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  _FallbackButton(label: 'Try again', onTap: () => GlobalErrorHandler.onRetry?.call()),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FallbackButton extends StatelessWidget {
  const _FallbackButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const colors = AppColors.light;
    final text = AppText.forColors(colors);
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 48, minWidth: 160),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colors.accent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(label, style: text.button),
        ),
      ),
    );
  }
}
