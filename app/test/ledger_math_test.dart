import 'package:flutter_test/flutter_test.dart';
import 'package:videomilla/core/logic/ledger_math.dart';
import 'package:videomilla/core/models/credit_pack.dart';

CreditPack pack(int credits) => CreditPack(productId: 'p$credits', credits: credits, channel: Channel.play);

void main() {
  group('clip credits', () {
    test('2 credits per second', () {
      expect(clipCredits(3), 6);
      expect(clipCredits(5), 10);
      expect(clipCredits(8), 16);
    });

    test('talking clip: larger of 6 and 2 per started second', () {
      expect(talkingClipCredits(2000), 6);
      expect(talkingClipCredits(3000), 6);
      expect(talkingClipCredits(5000), 10);
      expect(talkingClipCredits(5001), 12);
      expect(talkingClipCredits(8000), 16);
    });
  });

  group('previewCost', () {
    test('affordable', () {
      final p = previewCost(cost: 10, balance: 25);
      expect(p.balanceAfter, 15);
      expect(p.shortBy, 0);
      expect(p.canAfford, isTrue);
    });

    test('short', () {
      final p = previewCost(cost: 30, balance: 25);
      expect(p.balanceAfter, -5);
      expect(p.shortBy, 5);
      expect(p.canAfford, isFalse);
    });
  });

  group('projectEstimate matches the blueprint examples', () {
    int est(int shots, int chars, int animated) =>
        projectEstimate(shotCount: shots, characterCount: chars, animatedCount: animated);

    test('15 s, 3 shots, 1 character, 1 animated = 17', () => expect(est(3, 1, 1), 17));
    test('30 s = 34', () => expect(est(6, 2, 2), 34));
    test('45 s = 47', () => expect(est(9, 2, 3), 47));
    test('60 s = 60', () => expect(est(12, 2, 4), 60));
    test('90 s = 73', () => expect(est(15, 2, 5), 73));
    test('45 s all animated = 107', () => expect(est(9, 2, 9), 107));
  });

  group('smallestCoveringPack', () {
    final packs = <CreditPack>[pack(750), pack(25), pack(160), pack(90), pack(350)];

    test('picks the smallest that covers', () {
      expect(smallestCoveringPack(20, packs)!.credits, 25);
      expect(smallestCoveringPack(25, packs)!.credits, 25);
      expect(smallestCoveringPack(26, packs)!.credits, 90);
      expect(smallestCoveringPack(100, packs)!.credits, 160);
    });

    test('none covers: the largest', () => expect(smallestCoveringPack(751, packs)!.credits, 750));
    test('no packs', () => expect(smallestCoveringPack(5, const <CreditPack>[]), isNull));
  });

  group('regionalPriceOk', () {
    test('above the floor', () {
      expect(regionalPriceOk(0.99, 25), isTrue);
      expect(regionalPriceOk(4.99, 160), isTrue);
    });
    test('below the floor', () => expect(regionalPriceOk(0.30, 25), isFalse));
  });
}
