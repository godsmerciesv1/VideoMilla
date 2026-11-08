/// Referral arithmetic (blueprint Section 53). Every figure has the blueprint
/// value as its default and can be overridden from the server's `referral` config.

const int referralPercent = 10;
const int referralMinPackCredits = 90;
const int referralHoldDays = 14;
const int referralMaxPer30Days = 20;
const int referralMaxBonusPer30Days = 500;

/// 10% of the pack, rounded down: 90 gives 9, 160 gives 16, 350 gives 35, 750 gives 75.
int referralBonus(int packCredits, {int percent = referralPercent}) => (packCredits * percent) ~/ 100;

/// Only a first purchase of a pack with at least 90 credits qualifies.
bool isQualifyingPack(int packCredits, {int minCredits = referralMinPackCredits}) => packCredits >= minCredits;

/// Whether paying [newBonus] more keeps the referrer inside both rolling 30-day caps.
bool withinCaps({
  required int referralsIn30Days,
  required int bonusCreditsIn30Days,
  required int newBonus,
  int maxReferrals = referralMaxPer30Days,
  int maxBonus = referralMaxBonusPer30Days,
}) =>
    referralsIn30Days < maxReferrals && bonusCreditsIn30Days + newBonus <= maxBonus;

/// When the referrer's share is paid: the hold period after the purchase.
DateTime settlesAt(DateTime purchasedAt, {int holdDays = referralHoldDays}) =>
    purchasedAt.add(Duration(days: holdDays));
