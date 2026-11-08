import '../models/app_config.dart';

/// The server's config with an offline cache.
abstract interface class RemoteConfigService {
  /// Fetches from the server and caches the last good copy. Falls back to the cache when offline.
  Future<AppConfig> fetch();

  /// The most recent config: the fetched one, else the cached one, else [AppConfig.defaults].
  AppConfig get current;
}
