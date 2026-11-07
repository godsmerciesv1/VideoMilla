import 'package:flutter/foundation.dart';

import 'credit_pack.dart';
import 'json_helpers.dart';

Map<String, int> _intMap(Object? v) => Map<String, int>.unmodifiable(<String, int>{
      for (final e in readMap(v).entries)
        if (e.value is num) e.key: (e.value as num).toInt(),
    });

Map<String, bool> _boolMap(Object? v) => Map<String, bool>.unmodifiable(<String, bool>{
      for (final e in readMap(v).entries)
        if (e.value is bool) e.key: e.value as bool,
    });

Map<String, double> _doubleMap(Object? v) => Map<String, double>.unmodifiable(<String, double>{
      for (final e in readMap(v).entries)
        if (e.value is num) e.key: (e.value as num).toDouble(),
    });

/// Everything the Worker serves at `GET /config`: prices, packs, caps, flags,
/// languages. The apps never hard-code these (blueprint Section 23.10), so a
/// price or a flag changes without a release. Keys on the wire are snake_case.
@immutable
class AppConfig {
  const AppConfig({
    this.version = 0,
    this.flags = const <String, bool>{},
    this.creditCosts = const <String, int>{},
    this.packsPlay = const <CreditPack>[],
    this.packsPolar = const <CreditPack>[],
    this.languagesEnabled = const <String>[],
    this.voiceRoutes = const <String, dynamic>{},
    this.minAppVersion = '0.0.0',
    this.caps = const <String, double>{},
    this.fairUse = const <String, int>{},
    this.referral = const <String, dynamic>{},
    this.auth = const <String, dynamic>{},
  });

  factory AppConfig.fromJson(Map<String, dynamic> json) => AppConfig(
        version: readInt(json['version']),
        flags: _boolMap(json['flags']),
        creditCosts: _intMap(json['credit_costs']),
        packsPlay: List<CreditPack>.unmodifiable(
          readMapList(json['packs_play']).map((m) => CreditPack.fromJson(m, channel: Channel.play)),
        ),
        packsPolar: List<CreditPack>.unmodifiable(
          readMapList(json['packs_polar']).map((m) => CreditPack.fromJson(m, channel: Channel.polar)),
        ),
        languagesEnabled: readStringList(json['languages_enabled']),
        voiceRoutes: readMap(json['voice_routes']),
        minAppVersion: readString(json['min_app_version'], '0.0.0'),
        caps: _doubleMap(json['caps']),
        fairUse: _intMap(json['fair_use']),
        referral: readMap(json['referral']),
        auth: readMap(json['auth']),
      );

  /// Safe values used before the first successful fetch (and offline with no cache).
  /// Sign-in and Cartoon Me stay off until the server says otherwise.
  static const AppConfig defaults = AppConfig(
    flags: <String, bool>{'cartoon_me_enabled': false, 'google_signin_enabled': false},
    creditCosts: <String, int>{
      'analysis_free_per_project': 3,
      'analysis': 1,
      'character_sheet': 4,
      'portrait': 1,
      'picture': 1,
      'clip_per_second': 2,
      'studio_voice_per_9s': 1,
      'studio_voice_min': 2,
      'series_new_character': 4,
      'series_reuse_character': 0,
    },
    fairUse: <String, int>{'animated_seconds_per_day': 150, 'clips_in_flight': 2, 'pictures_per_day': 200},
  );

  /// Bumped by the server when config changes.
  final int version;
  final Map<String, bool> flags;
  final Map<String, int> creditCosts;
  final List<CreditPack> packsPlay;
  final List<CreditPack> packsPolar;
  final List<String> languagesEnabled;
  final Map<String, dynamic> voiceRoutes;
  final String minAppVersion;

  /// Daily spend caps in USD (the app only reads them to explain "busy").
  final Map<String, double> caps;
  final Map<String, int> fairUse;
  final Map<String, dynamic> referral;
  final Map<String, dynamic> auth;

  bool flag(String key, {bool orElse = false}) => flags[key] ?? orElse;

  /// A credit cost from config, falling back to the blueprint default.
  int cost(String key) => creditCosts[key] ?? defaults.creditCosts[key] ?? 0;

  int fair(String key) => fairUse[key] ?? defaults.fairUse[key] ?? 0;

  bool get cartoonMeEnabled => flag('cartoon_me_enabled');
  bool get googleSignInEnabled => flag('google_signin_enabled');

  Map<String, dynamic> toJson() => <String, dynamic>{
        'version': version,
        'flags': flags,
        'credit_costs': creditCosts,
        'packs_play': <Map<String, dynamic>>[for (final p in packsPlay) p.toJson()],
        'packs_polar': <Map<String, dynamic>>[for (final p in packsPolar) p.toJson()],
        'languages_enabled': languagesEnabled,
        'voice_routes': voiceRoutes,
        'min_app_version': minAppVersion,
        'caps': caps,
        'fair_use': fairUse,
        'referral': referral,
        'auth': auth,
      };

  @override
  bool operator ==(Object other) =>
      other is AppConfig &&
      other.version == version &&
      mapEquals(other.flags, flags) &&
      mapEquals(other.creditCosts, creditCosts) &&
      sameList(other.packsPlay, packsPlay) &&
      sameList(other.packsPolar, packsPolar) &&
      sameList(other.languagesEnabled, languagesEnabled) &&
      mapEquals(other.voiceRoutes, voiceRoutes) &&
      other.minAppVersion == minAppVersion &&
      mapEquals(other.caps, caps) &&
      mapEquals(other.fairUse, fairUse) &&
      mapEquals(other.referral, referral) &&
      mapEquals(other.auth, auth);

  @override
  int get hashCode => Object.hash(
        version,
        Object.hashAllUnordered(flags.entries.map((e) => Object.hash(e.key, e.value))),
        Object.hashAllUnordered(creditCosts.entries.map((e) => Object.hash(e.key, e.value))),
        Object.hashAll(packsPlay),
        Object.hashAll(packsPolar),
        Object.hashAll(languagesEnabled),
        minAppVersion,
        Object.hashAllUnordered(fairUse.entries.map((e) => Object.hash(e.key, e.value))),
      );
}
