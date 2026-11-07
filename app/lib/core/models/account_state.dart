import 'package:flutter/foundation.dart';

import 'json_helpers.dart';

enum AuthMethod { email, google }

/// Who is signed in on this device. Anonymous until the first purchase.
@immutable
class AccountState {
  const AccountState({
    this.signedIn = false,
    this.email,
    this.method,
    this.deviceCount = 0,
    this.referralCode,
    this.cartoonMeAttested = false,
  });

  const AccountState.anonymous()
      : signedIn = false,
        email = null,
        method = null,
        deviceCount = 0,
        referralCode = null,
        cartoonMeAttested = false;

  /// Reads `GET /me`.
  factory AccountState.fromJson(Map<String, dynamic> json) {
    final methodName = readStringOrNull(json['method']);
    return AccountState(
      signedIn: readBool(json['signed_in'], true),
      email: readStringOrNull(json['email']),
      method: methodName == null ? null : enumFromName(AuthMethod.values, methodName, orElse: AuthMethod.email),
      deviceCount: readInt(json['device_count']),
      referralCode: readStringOrNull(json['referral_code']),
      cartoonMeAttested: readBool(json['adult_attested']),
    );
  }

  final bool signedIn;
  final String? email;
  final AuthMethod? method;
  final int deviceCount;
  final String? referralCode;

  /// The user confirmed that Cartoon Me uses their own face and that they are 18 or older.
  final bool cartoonMeAttested;

  AccountState copyWith({
    bool? signedIn,
    String? email,
    AuthMethod? method,
    int? deviceCount,
    String? referralCode,
    bool? cartoonMeAttested,
  }) =>
      AccountState(
        signedIn: signedIn ?? this.signedIn,
        email: email ?? this.email,
        method: method ?? this.method,
        deviceCount: deviceCount ?? this.deviceCount,
        referralCode: referralCode ?? this.referralCode,
        cartoonMeAttested: cartoonMeAttested ?? this.cartoonMeAttested,
      );

  @override
  bool operator ==(Object other) =>
      other is AccountState &&
      other.signedIn == signedIn &&
      other.email == email &&
      other.method == method &&
      other.deviceCount == deviceCount &&
      other.referralCode == referralCode &&
      other.cartoonMeAttested == cartoonMeAttested;

  @override
  int get hashCode => Object.hash(signedIn, email, method, deviceCount, referralCode, cartoonMeAttested);
}
