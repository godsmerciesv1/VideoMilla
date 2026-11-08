import 'package:flutter/foundation.dart';

import '../models/account_state.dart';

/// Gives the sign-in adapter a Google ID token. Implemented by the web
/// (Google Identity Services) and by Android (the `google_sign_in` plugin).
abstract interface class GoogleIdTokenSource {
  /// Null when the user cancels.
  Future<String?> idToken();
}

/// A device signed in to the account.
@immutable
class SignedInDevice {
  const SignedInDevice({required this.id, required this.platform, required this.lastSeen, this.isCurrent = false});

  final String id;
  final String platform;
  final DateTime lastSeen;
  final bool isCurrent;
}

/// Accounts and sign-in (blueprint Section 52): email (a link plus a 6-digit code) and Google.
/// Signing in points this device at the account's wallet and merges its anonymous wallet into it.
abstract interface class AuthService {
  /// Asks for a login email. Always answers as sent, whether or not the address has an account.
  Future<void> requestEmail({required String email, required String language, String? referralCode});

  /// Verifies the 6-digit code typed into the app.
  Future<AccountState> verifyCode({required String email, required String code});

  /// Verifies the link token from the web (`#/auth?token=...`).
  Future<AccountState> verifyToken(String token);

  /// Uses the [GoogleIdTokenSource] to sign in with Google.
  Future<AccountState> signInWithGoogle();

  /// This device gets a fresh anonymous wallet; the account is untouched.
  Future<void> signOut();

  /// Deletes the account and its wallet on the server.
  Future<void> deleteAccount();

  Future<AccountState> account();

  Future<List<SignedInDevice>> devices();

  Future<void> removeDevice(String id);
}
