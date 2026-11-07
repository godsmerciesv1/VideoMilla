import 'package:flutter/widgets.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Semantic icon names used across the app.
enum AppIconAlias {
  create,
  approve,
  retry,
  regenerate,
  report,
  share,
  download,
  play,
  settings,
  store,
  credits,
  wallet,
  link,
  language,
  delete,
  info,
  back,
  close,
  chevron,
  check,
  warning,
  alert,
  offline,
  animate,
  pan,
}

/// The only file that imports the icon package. Every glyph is Phosphor Bold.
abstract final class AppIcons {
  static IconData of(AppIconAlias alias) {
    switch (alias) {
      case AppIconAlias.create:
        return PhosphorIconsBold.plus;
      case AppIconAlias.approve:
        return PhosphorIconsBold.checkCircle;
      case AppIconAlias.retry:
        return PhosphorIconsBold.arrowClockwise;
      case AppIconAlias.regenerate:
        return PhosphorIconsBold.arrowsClockwise;
      case AppIconAlias.report:
        return PhosphorIconsBold.flag;
      case AppIconAlias.share:
        return PhosphorIconsBold.export;
      case AppIconAlias.download:
        return PhosphorIconsBold.downloadSimple;
      case AppIconAlias.play:
        return PhosphorIconsBold.play;
      case AppIconAlias.settings:
        return PhosphorIconsBold.gear;
      case AppIconAlias.store:
        return PhosphorIconsBold.storefront;
      case AppIconAlias.credits:
        return PhosphorIconsBold.coins;
      case AppIconAlias.wallet:
        return PhosphorIconsBold.wallet;
      case AppIconAlias.link:
        return PhosphorIconsBold.link;
      case AppIconAlias.language:
        return PhosphorIconsBold.translate;
      case AppIconAlias.delete:
        return PhosphorIconsBold.trash;
      case AppIconAlias.info:
        return PhosphorIconsBold.info;
      case AppIconAlias.back:
        return PhosphorIconsBold.caretLeft;
      case AppIconAlias.close:
        return PhosphorIconsBold.x;
      case AppIconAlias.chevron:
        return PhosphorIconsBold.caretRight;
      case AppIconAlias.check:
        return PhosphorIconsBold.check;
      case AppIconAlias.warning:
        return PhosphorIconsBold.warning;
      case AppIconAlias.alert:
        return PhosphorIconsBold.warningOctagon;
      case AppIconAlias.offline:
        return PhosphorIconsBold.wifiSlash;
      case AppIconAlias.animate:
        return PhosphorIconsBold.filmStrip;
      case AppIconAlias.pan:
        return PhosphorIconsBold.arrowsOutLineHorizontal;
    }
  }

  /// Glyphs that point in a direction and must mirror in right-to-left layouts.
  static bool isDirectional(AppIconAlias alias) =>
      alias == AppIconAlias.back || alias == AppIconAlias.chevron;
}
