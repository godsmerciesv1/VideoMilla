import 'package:flutter_test/flutter_test.dart';
import 'package:videomilla/core/logic/render_plan.dart';
import 'package:videomilla/core/models/clip.dart';
import 'package:videomilla/core/models/project.dart';
import 'package:videomilla/core/models/render_spec.dart';
import 'package:videomilla/core/models/shot.dart';
import 'package:videomilla/core/models/sound_choice.dart';
import 'package:videomilla/core/models/style_preset.dart';

final DateTime t0 = DateTime.utc(2026, 11, 7);

Project project({AspectOption aspect = AspectOption.portrait}) =>
    Project(id: 'proj-1', title: 't', createdAt: t0, updatedAt: t0, aspect: aspect);

const StylePreset style = StylePreset(id: StyleId.storybook, name: 'Storybook', styleText: 'x');

Shot shot(
  int i, {
  String? image = 'img',
  int durationMs = 3000,
  String narration = '',
  int? audioMs,
  MotionKind motion = MotionKind.zoomIn,
  List<SpeakerLine> lines = const <SpeakerLine>[],
}) =>
    Shot(
      id: 's$i',
      sceneId: 'sc',
      order: i,
      durationMs: durationMs,
      visual: 'v',
      imagePath: image == null ? null : '$image$i',
      narration: narration,
      narrationAudioPath: audioMs == null ? null : 'n$i',
      narrationAudioMs: audioMs,
      motion: motion,
      lines: lines,
    );

Clip clip(int i, {int seconds = 5, ClipState state = ClipState.kept, bool talking = false}) =>
    Clip(id: 'c$i', shotId: 's$i', key: 'k$i', seconds: seconds, createdAt: t0, state: state, videoPath: 'clip$i', talking: talking);

void main() {
  test('a kept clip wins over the shot length; a still stretches to its audio', () {
    final plan = buildRenderPlan(
      project: project(),
      shots: <Shot>[
        shot(0, narration: 'Hello there.', audioMs: 2000),
        shot(1, narration: 'Second shot.', audioMs: 4000, motion: MotionKind.panLeft),
      ],
      clips: <Clip>[clip(0)],
      style: style,
    );
    expect(plan.width, 720);
    expect(plan.height, 1280);
    expect(plan.segments.length, 2);

    final a = plan.segments[0];
    expect(a.kind, SegmentKind.clip);
    expect(a.path, 'clip0');
    expect(a.startMs, 0);
    expect(a.durationMs, 5000);

    final b = plan.segments[1];
    expect(b.kind, SegmentKind.still);
    expect(b.startMs, 5000);
    expect(b.durationMs, 4000);
    expect(b.motion, MotionKind.panLeft);
    expect(plan.totalMs, 9000);
  });

  test('narration is placed at the start of its segment and voices never overlap', () {
    final plan = buildRenderPlan(
      project: project(),
      shots: <Shot>[shot(0, narration: 'Hello there.', audioMs: 2000), shot(1, narration: 'Second shot.', audioMs: 4000)],
      clips: const <Clip>[],
      style: style,
    );
    expect(plan.audioEvents.length, 2);
    expect(plan.audioEvents[0].offsetMs, 0);
    expect(plan.audioEvents[1].offsetMs, plan.segments[1].startMs);
    for (var i = 1; i < plan.audioEvents.length; i++) {
      expect(plan.audioEvents[i].offsetMs, greaterThanOrEqualTo(plan.audioEvents[i - 1].endMs));
    }
  });

  test('captions follow the spoken text, timed in video time', () {
    final plan = buildRenderPlan(
      project: project(),
      shots: <Shot>[shot(0, narration: 'Hello there.', audioMs: 2000), shot(1, narration: 'Second shot.', audioMs: 4000)],
      clips: const <Clip>[],
      style: style,
    );
    expect(plan.captions.length, 2);
    expect(plan.captions[0].text, 'Hello there.');
    expect(plan.captions[0].startMs, 0);
    expect(plan.captions[0].endMs, 2000);
    expect(plan.captions[1].text, 'Second shot.');
    expect(plan.captions[1].startMs, plan.segments[1].startMs);
    expect(plan.captions[1].endMs, plan.segments[1].startMs + 4000);
  });

  test('a rejected clip is ignored and the picture is used', () {
    final plan = buildRenderPlan(
      project: project(),
      shots: <Shot>[shot(0, narration: 'Hello there.', audioMs: 2000)],
      clips: <Clip>[clip(0, state: ClipState.rejected)],
      style: style,
    );
    expect(plan.segments.single.kind, SegmentKind.still);
    expect(plan.segments.single.path, 'img0');
    expect(plan.segments.single.durationMs, 3000);
  });

  test('a shot with neither picture nor clip is skipped', () {
    final plan = buildRenderPlan(project: project(), shots: <Shot>[shot(0, image: null), shot(1)], clips: const <Clip>[], style: style);
    expect(plan.segments.length, 1);
    expect(plan.segments.single.shotId, 's1');
    expect(plan.segments.single.startMs, 0);
  });

  test('shots are placed in shot order whatever order they arrive in', () {
    final plan = buildRenderPlan(project: project(), shots: <Shot>[shot(1), shot(0)], clips: const <Clip>[], style: style);
    expect(plan.segments.map((s) => s.shotId), <String>['s0', 's1']);
  });

  test('a talking clip plays the character line audio at the segment start', () {
    final talking = shot(
      0,
      lines: const <SpeakerLine>[SpeakerLine(characterId: 'mara', text: 'Wait for me!', audioPath: 'l0', audioMs: 3000)],
    );
    final plan = buildRenderPlan(project: project(), shots: <Shot>[talking], clips: <Clip>[clip(0, seconds: 3, talking: true)], style: style);
    expect(plan.segments.single.durationMs, 3000);
    expect(plan.audioEvents.single.kind, AudioKind.line);
    expect(plan.audioEvents.single.characterId, 'mara');
    expect(plan.audioEvents.single.offsetMs, 0);
    expect(plan.captions.single.text, 'Wait for me!');
  });

  test('narration then lines play one after another inside a segment', () {
    final s = shot(
      0,
      narration: 'Meanwhile.',
      audioMs: 1000,
      durationMs: 2000,
      lines: const <SpeakerLine>[SpeakerLine(characterId: 'mara', text: 'Hi.', audioPath: 'l0', audioMs: 1500)],
    );
    final plan = buildRenderPlan(project: project(), shots: <Shot>[s], clips: const <Clip>[], style: style);
    expect(plan.audioEvents.map((a) => a.offsetMs), <int>[0, 1000]);
    expect(plan.segments.single.durationMs, 2500);
  });

  test('landscape size, language, caption style, grade and sound are carried over', () {
    final p = Project(
      id: 'proj-1',
      title: 't',
      createdAt: t0,
      updatedAt: t0,
      aspect: AspectOption.landscape,
      contentLanguage: 'ar',
      captionStyle: CaptionStyle.outline,
    );
    final plan = buildRenderPlan(
      project: p,
      shots: <Shot>[shot(0)],
      clips: const <Clip>[],
      style: const StylePreset(id: StyleId.cinematic, name: 'c', styleText: 'x', grade: ColorGrade(saturation: 0.9)),
      sound: const SoundChoice(source: SoundSource.library, trackId: 'rain-soft'),
    );
    expect(plan.width, 1280);
    expect(plan.height, 720);
    expect(plan.language, 'ar');
    expect(plan.captionStyle, CaptionStyle.outline);
    expect(plan.grade.saturation, 0.9);
    expect(plan.hasSound, isTrue);
    expect(plan.fps, 25);
  });

  test('the plan survives a JSON round trip', () {
    final plan = buildRenderPlan(
      project: project(),
      shots: <Shot>[shot(0, narration: 'Hello there.', audioMs: 2000)],
      clips: <Clip>[clip(0)],
      style: style,
      sound: const SoundChoice(source: SoundSource.user, userPath: 'mine', volume: 35),
    );
    expect(RenderSpec.fromJson(plan.toJson()), plan);
  });

  group('still motion curves', () {
    test('zoom in goes from 1.00 to 1.12', () {
      final c = curveFor(MotionKind.zoomIn);
      expect(c.at(0).scale, 1.0);
      expect(c.at(1).scale, closeTo(1.12, 1e-9));
    });
    test('zoom out goes from 1.12 to 1.00', () {
      final c = curveFor(MotionKind.zoomOut);
      expect(c.at(0).scale, closeTo(1.12, 1e-9));
      expect(c.at(1).scale, 1.0);
    });
    test('pans hold 1.10 and move 4% each way, reversed for panRight', () {
      final left = curveFor(MotionKind.panLeft);
      expect(left.at(0).x, closeTo(0.04, 1e-9));
      expect(left.at(1).x, closeTo(-0.04, 1e-9));
      expect(left.at(0.5).scale, closeTo(1.10, 1e-9));
      final right = curveFor(MotionKind.panRight);
      expect(right.at(0).x, closeTo(-0.04, 1e-9));
      expect(right.at(1).x, closeTo(0.04, 1e-9));
    });
    test('hold does not move and animate falls back to a zoom in', () {
      final hold = curveFor(MotionKind.hold);
      expect(hold.at(0.7).scale, 1.0);
      expect(curveFor(MotionKind.animate).at(1).scale, closeTo(1.12, 1e-9));
    });
    test('progress is clamped', () {
      expect(curveFor(MotionKind.zoomIn).at(2).scale, closeTo(1.12, 1e-9));
      expect(curveFor(MotionKind.zoomIn).at(-1).scale, 1.0);
    });
  });
}
