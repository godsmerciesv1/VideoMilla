import 'package:flutter_test/flutter_test.dart';
import 'package:videomilla/core/logic/dialogue_planner.dart';
import 'package:videomilla/core/models/character_profile.dart';
import 'package:videomilla/core/models/shot.dart';

const CharacterProfile mara = CharacterProfile(id: 'mara', name: 'Mara', voiceId: 'v-mara');
const CharacterProfile tom = CharacterProfile(id: 'tom', name: 'Tom');

Shot shot(int i, {String narration = '', List<SpeakerLine> lines = const <SpeakerLine>[]}) =>
    Shot(id: 's$i', sceneId: 'sc', order: i, durationMs: 3000, visual: 'v', narration: narration, lines: lines);

SpeakerLine line(String who, {int? ms, String text = 'Hello'}) => SpeakerLine(characterId: who, text: text, audioMs: ms);

List<ShotDialoguePlan> run(List<Shot> shots, {Set<String> animated = const <String>{}, Set<String> failed = const <String>{}}) =>
    planDialogue(
      shots: shots,
      characters: const <CharacterProfile>[mara, tom],
      narratorVoiceId: 'v-narr',
      animatedShotIds: animated,
      lipSyncFailed: failed,
    );

void main() {
  test('narration only: the narrator reads it', () {
    final p = run(<Shot>[shot(0, narration: 'Once upon a time.')]).single;
    expect(p.mode, ShotAudioMode.narration);
    expect(p.needs.single.voiceId, 'v-narr');
    expect(p.needs.single.characterId, isNull);
  });

  test('a shot with no words needs no audio', () {
    final p = run(<Shot>[shot(0)]).single;
    expect(p.mode, ShotAudioMode.narration);
    expect(p.needs, isEmpty);
  });

  test('an animated shot with one short line is a talking shot in that character voice', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('mara', ms: 3000)])], animated: <String>{'s0'}).single;
    expect(p.mode, ShotAudioMode.talking);
    expect(p.needs.single.characterId, 'mara');
    expect(p.needs.single.voiceId, 'v-mara');
  });

  test('the same shot, not animated, is a voice-over', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('mara', ms: 3000)])]).single;
    expect(p.mode, ShotAudioMode.voiceOver);
  });

  test('a line longer than 8 seconds is a voice-over even when animated', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('mara', ms: 9000)])], animated: <String>{'s0'}).single;
    expect(p.mode, ShotAudioMode.voiceOver);
  });

  test('exactly 8 seconds still lip-syncs', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('mara', ms: 8000)])], animated: <String>{'s0'}).single;
    expect(p.mode, ShotAudioMode.talking);
  });

  test('a line whose length is not known yet is assumed to fit', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('mara')])], animated: <String>{'s0'}).single;
    expect(p.mode, ShotAudioMode.talking);
  });

  test('after a lip-sync failure the shot becomes a voice-over', () {
    final p = run(
      <Shot>[shot(0, lines: <SpeakerLine>[line('mara', ms: 3000)])],
      animated: <String>{'s0'},
      failed: <String>{'s0'},
    ).single;
    expect(p.mode, ShotAudioMode.voiceOver);
  });

  test('narration plus a line is a voice-over, narration first', () {
    final p = run(<Shot>[shot(0, narration: 'Meanwhile.', lines: <SpeakerLine>[line('mara')])], animated: <String>{'s0'}).single;
    expect(p.mode, ShotAudioMode.voiceOver);
    expect(p.needs.map((n) => n.characterId), <String?>[null, 'mara']);
  });

  test('two lines are a voice-over in order, each in its own voice', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('mara'), line('tom')])], animated: <String>{'s0'}).single;
    expect(p.mode, ShotAudioMode.voiceOver);
    expect(p.needs.map((n) => n.characterId), <String?>['mara', 'tom']);
    expect(p.needs[0].voiceId, 'v-mara');
  });

  test('a character without a voice falls back to the narrator voice', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('tom')])]).single;
    expect(p.needs.single.voiceId, 'v-narr');
    expect(p.needs.single.characterId, 'tom');
  });

  test('an unknown speaker is read by the narrator and flagged', () {
    final p = run(<Shot>[shot(0, lines: <SpeakerLine>[line('ghost')])], animated: <String>{'s0'}).single;
    expect(p.mode, ShotAudioMode.voiceOver);
    expect(p.needs.single.fallbackToNarrator, isTrue);
    expect(p.needs.single.voiceId, 'v-narr');
    expect(p.needs.single.characterId, isNull);
  });

  test('plans come back in shot order', () {
    final plans = run(<Shot>[shot(2, narration: 'c'), shot(0, narration: 'a'), shot(1, narration: 'b')]);
    expect(plans.map((p) => p.shotId), <String>['s0', 's1', 's2']);
  });
}
