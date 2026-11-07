/// The only place these values live.
abstract final class AppConstants {
  static const String appName = 'VideoMilla';
  static const String packageId = 'com.zdmgold.videomilla';

  /// Never printed on a screen: the UI shows a "Contact support" link that opens
  /// this address (decision D-015). The two literals are joined on purpose.
  static const String supportEmail = 'stmakarios' '@gmail.com';
  static const String supportMailto = 'mailto:$supportEmail';

  /// Build defines (`--dart-define`). Defaults point at today's addresses and
  /// move to the custom domain without a code change (decisions D-014, D-012).
  static const String siteBase = String.fromEnvironment(
    'SITE_BASE',
    defaultValue: 'https://videomilla.godsmerciesv1.workers.dev',
  );
  static const String appBase = String.fromEnvironment(
    'APP_BASE',
    defaultValue: 'https://videomilla-app.pages.dev',
  );

  /// Empty until the API is deployed; set by the workflows.
  static const String apiBase = String.fromEnvironment('API_BASE');

  static const String webAppUrl = appBase;
  static const String privacyUrl = '$siteBase/privacy.html';
  static const String termsUrl = '$siteBase/terms.html';
  static const String supportUrl = '$siteBase/support.html';
  static const String childSafetyUrl = '$siteBase/child-safety.html';
  static const String deleteUrl = '$siteBase/delete-account.html';
  static const String refundsUrl = '$siteBase/refunds.html';
  static const String soundsBase = '$siteBase/sounds/';

  // Limits (blueprint Sections 5.1, 5.2, 5.10).
  static const int minWords = 10;
  static const int maxWords = 450;
  static const int minLengthSeconds = 5;
  static const int maxLengthSeconds = 90;
  static const int maxShots = 15;
  static const int maxCharacters = 6;
  static const int maxDevices = 10;
  static const int referralCodeLength = 8;
}
