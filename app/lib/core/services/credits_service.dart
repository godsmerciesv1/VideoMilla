import '../models/app_config.dart';
import '../models/wallet_state.dart';

/// The wallet and the server's config, over the Worker (`GET /balance`, `GET /config`, `GET /me/export`).
/// Part IX removed every code and device-link call from this contract: accounts replace them.
abstract interface class CreditsService {
  Future<WalletState> balance();

  Future<AppConfig> config();

  /// The ledger and purchase records as JSON, for "Export my data". Never contains secrets.
  Future<Map<String, dynamic>> exportData();
}
