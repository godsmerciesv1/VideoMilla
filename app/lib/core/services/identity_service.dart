import 'package:flutter/foundation.dart';

/// This device's credential: an id and a secret the server knows only as a hash.
@immutable
class Device {
  const Device({required this.id, required this.secret});

  final String id;
  final String secret;
}

/// The device credential and whether this device is signed in to an account.
/// Android keeps it in the keystore, the web in browser storage. No recovery code exists any more.
abstract interface class IdentityService {
  /// Returns the stored credential, registering a new anonymous device first if there is none.
  Future<Device> ensureDevice();

  /// Replaces the credential (after sign-out the server issues a fresh anonymous one).
  Future<void> replaceDevice(Device device);

  Future<void> markSignedIn(bool signedIn);
  Future<bool> isSignedIn();

  /// Forgets everything stored (the credential and the signed-in flag).
  Future<void> clear();
}
