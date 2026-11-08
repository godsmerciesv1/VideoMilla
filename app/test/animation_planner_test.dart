import 'package:flutter_test/flutter_test.dart';
import 'package:videomilla/core/logic/animation_planner.dart';
import 'package:videomilla/core/models/motion_plan.dart';
import 'package:videomilla/core/models/shot.dart';

Shot shot(int i, {MotionKind motion = MotionKind.zoomIn, List<SpeakerLine> lines = const <SpeakerLine>[], String narration = 'n'}) =>
    Shot(id: 's$i', sceneId: 'sc', order: i, durationMs: 3000, visual: 'v', motion: motion, lines: lines, narration: narration);

void main() {
  test('recommended count for 1 to 15 shots', () {
    const expected = <int>[1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5];
    for (var n = 1; n <= 15; n++) {
      expect(recommended(n), expected[n - 1], reason: 'n = $n');
    }
    expect(recommended(0), 0);
  });

  test('half rounded up for 1 to 15 shots', () {
    const expected = <int>[1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8];
    for (var n = 1; n <= 15; n++) {
      expect(heavierMax(n), expected[n - 1], reason: 'n = $n');
    }
  });

  group('zones (blueprint worked examples)', () {
    void expectZones(int n, int greenTo, int amberTo) {
      for (var k = 0; k <= n; k++) {
        final z = zoneFor(n, k);
        final want = k <= greenTo
            ? AnimationZone.green
            : k <= amberTo
                ? AnimationZone.amber
                : AnimationZone.red;
        expect(z, want, reason: 'n = $n, k = $k');
      }
    }

    test('n = 6: green to 2, amber 3, red 4 to 6', () => expectZones(6, 2, 3));
    test('n = 9: green to 3, amber 4 to 5, red 6 to 9', () => expectZones(9, 3, 5));
    test('n = 15: green to 5, amber 6 to 8, red 9 to 15', () => expectZones(15, 5, 8));
    test('n = 1: one shot is green', () {
      expect(zoneFor(1, 0), AnimationZone.green);
      expect(zoneFor(1, 1), AnimationZone.green);
    });
  });

  test('confirming all needs three or more shots', () {
    expect(needsConfirmAll(3, 3), isTrue);
    expect(needsConfirmAll(9, 9), isTrue);
    expect(needsConfirmAll(2, 2), isFalse);
    expect(needsConfirmAll(9, 8), isFalse);
  });

  test('warnings by zone', () {
    expect(warningKeys(AnimationZone.green), isEmpty);
    expect(warningKeys(AnimationZone.amber), isNotEmpty);
    expect(warningKeys(AnimationZone.red).length, greaterThan(warningKeys(AnimationZone.amber).length));
  });

  group('autoSelect', () {
    test('first shot, then ties go to the earlier shot, result in shot order', () {
      final shots = <Shot>[
        shot(0),
        shot(1),
        shot(2, narration: '', lines: const <SpeakerLine>[SpeakerLine(characterId: 'm', text: 'Hi')]),
        shot(3, motion: MotionKind.animate),
        shot(4),
        shot(5),
      ];
      // scores: s0 = 3, s2 = 2 (one line), s3 = 2 (animate), s5 = 1 (last). Recommended for 6 is 2.
      expect(autoSelect(shots), <String>['s0', 's2']);
    });

    test('picks the recommended count', () {
      final shots = <Shot>[for (var i = 0; i < 9; i++) shot(i)];
      expect(autoSelect(shots).length, 3);
    });

    test('an empty list selects nothing', () => expect(autoSelect(const <Shot>[]), isEmpty));
  });

  group('plan', () {
    final six = <Shot>[for (var i = 0; i < 6; i++) shot(i)];

    test('two shots of 5 s: green, 20 credits, 10 seconds', () {
      final p = plan(six, <String>['s0', 's1']);
      expect(p.zone, AnimationZone.green);
      expect(p.credits, 20);
      expect(p.animatedSeconds, 10);
      expect(p.k, 2);
      expect(p.n, 6);
    });

    test('three shots: amber', () {
      final p = plan(six, <String>['s0', 's1', 's2']);
      expect(p.zone, AnimationZone.amber);
      expect(p.credits, 30);
      expect(p.needsConfirmHigh, isFalse);
    });

    test('four shots: red and needs confirmation', () {
      final p = plan(six, <String>['s0', 's1', 's2', 's3']);
      expect(p.zone, AnimationZone.red);
      expect(p.needsConfirmHigh, isTrue);
      expect(p.needsConfirmAll, isFalse);
    });

    test('all shots need the extra confirmation', () {
      final p = plan(six, <String>[for (final s in six) s.id]);
      expect(p.needsConfirmAll, isTrue);
    });

    test('unknown ids are ignored', () => expect(plan(six, <String>['nope']).k, 0));

    test('a talking shot is billed by its audio', () {
      final talking = shot(0, narration: '', lines: const <SpeakerLine>[SpeakerLine(characterId: 'm', text: 'Hi', audioMs: 3000)]);
      final p = plan(<Shot>[talking, shot(1), shot(2)], <String>['s0']);
      expect(p.credits, 6);
      expect(p.animatedSeconds, 3);
    });

    test('a line longer than 8 s is not a talking shot', () {
      final long = shot(0, narration: '', lines: const <SpeakerLine>[SpeakerLine(characterId: 'm', text: 'Hi', audioMs: 9000)]);
      final p = plan(<Shot>[long, shot(1), shot(2)], <String>['s0']);
      expect(p.credits, 10);
    });
  });
}
