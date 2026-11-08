import 'package:flutter_test/flutter_test.dart';
import 'package:videomilla/core/logic/referral_math.dart';

void main() {
  test('bonus is 10% rounded down', () {
    expect(referralBonus(90), 9);
    expect(referralBonus(160), 16);
    expect(referralBonus(350), 35);
    expect(referralBonus(750), 75);
    expect(referralBonus(25), 2);
  });

  test('only packs of 90 or more qualify', () {
    expect(isQualifyingPack(25), isFalse);
    expect(isQualifyingPack(89), isFalse);
    expect(isQualifyingPack(90), isTrue);
    expect(isQualifyingPack(750), isTrue);
  });

  group('caps', () {
    test('inside both caps', () {
      expect(withinCaps(referralsIn30Days: 19, bonusCreditsIn30Days: 480, newBonus: 16), isTrue);
    });
    test('the 21st referral is not paid', () {
      expect(withinCaps(referralsIn30Days: 20, bonusCreditsIn30Days: 0, newBonus: 9), isFalse);
    });
    test('bonus credit cap', () {
      expect(withinCaps(referralsIn30Days: 3, bonusCreditsIn30Days: 490, newBonus: 16), isFalse);
      expect(withinCaps(referralsIn30Days: 3, bonusCreditsIn30Days: 484, newBonus: 16), isTrue);
    });
  });

  test('referrer share is paid after 14 days', () {
    final bought = DateTime.utc(2026, 11, 1, 10);
    expect(settlesAt(bought), DateTime.utc(2026, 11, 15, 10));
  });
}
