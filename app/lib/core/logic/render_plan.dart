import 'dart:math' as math;

import '../models/clip.dart';
import '../models/project.dart';
import '../models/render_spec.dart';
import '../models/shot.dart';
import '../models/sound_choice.dart';
import '../models/style_preset.dart';
import 'caption_splitter.dart';

/// The platform-neutral description of the finished video. Both renderers
/// (Android Media3, web WebCodecs) consume it; `RenderPlan` and `RenderSpec` are one type.
typedef RenderPlan = RenderSpec;

/// How a still picture moves over its segment. [at] gives scale and horizontal
/// offset (as a fraction of the width) at progress t in [0, 1].
class MotionCurve {
  const MotionCurve({required this.scale0, required this.scale1, required this.x0, required this.x1});

  final double scale0;
  final double scale1;
  final double x0;
  final double x1;

  ({double scale, double x}) at(double t) {
    final p = t.clamp(0.0, 1.0).toDouble();
    return (scale: scale0 + (scale1 - scale0) * p, x: x0 + (x1 - x0) * p);
  }
}

/// zoomIn 1.00 to 1.12; zoomOut 1.12 to 1.00; panLeft and panRight hold scale 1.10 and move
/// x from +4% to -4% of the width (reversed for panRight); hold stays at 1.00.
/// A shot marked `animate` that has no kept clip falls back to a gentle zoom in.
MotionCurve curveFor(MotionKind motion) {
  switch (motion) {
    case MotionKind.zoomIn:
    case MotionKind.animate:
      return const MotionCurve(scale0: 1.0, scale1: 1.12, x0: 0, x1: 0);
    case MotionKind.zoomOut:
      return const MotionCurve(scale0: 1.12, scale1: 1.0, x0: 0, x1: 0);
    case MotionKind.panLeft:
      return const MotionCurve(scale0: 1.10, scale1: 1.10, x0: 0.04, x1: -0.04);
    case MotionKind.panRight:
      return const MotionCurve(scale0: 1.10, scale1: 1.10, x0: -0.04, x1: 0.04);
    case MotionKind.hold:
      return const MotionCurve(scale0: 1.0, scale1: 1.0, x0: 0, x1: 0);
  }
}

/// Builds the render plan.
///
/// * One segment per shot that has a picture or a kept clip, in shot order.
/// * A kept clip makes a clip segment whose length is the clip's own length (it wins over the
///   shot's planned length); otherwise a still segment as long as the shot, stretched if its
///   audio is longer.
/// * Audio per segment: narration first, then speaker lines in order, never overlapping.
/// * Captions: the spoken text of each audio piece, timed to that piece.
RenderPlan buildRenderPlan({
  required Project project,
  required List<Shot> shots,
  required List<Clip> clips,
  required StylePreset style,
  SoundChoice? sound,
  int fps = RenderSpec.defaultFps,
}) {
  final ordered = List<Shot>.of(shots)..sort((a, b) => a.order.compareTo(b.order));
  final keptByShot = <String, Clip>{
    for (final c in clips)
      if (c.state == ClipState.kept && c.videoPath != null) c.shotId: c,
  };
  final captionMax = maxCharsFor(project.contentLanguage);

  final segments = <RenderSegment>[];
  final audio = <AudioEvent>[];
  final captions = <Caption>[];
  var cursor = 0;

  for (final shot in ordered) {
    final clip = keptByShot[shot.id];
    if (clip == null && shot.imagePath == null) continue;

    // Voice pieces for this shot, in playing order.
    final pieces = <({String path, int ms, String text, AudioKind kind, String? who})>[];
    if (shot.narrationAudioPath != null && shot.narrationAudioMs != null) {
      pieces.add((path: shot.narrationAudioPath!, ms: shot.narrationAudioMs!, text: shot.narration, kind: AudioKind.narration, who: null));
    }
    for (final l in shot.lines) {
      if (l.audioPath != null && l.audioMs != null) {
        pieces.add((path: l.audioPath!, ms: l.audioMs!, text: l.text, kind: AudioKind.line, who: l.characterId));
      }
    }
    final audioTotal = pieces.fold<int>(0, (a, p) => a + p.ms);

    final int length;
    if (clip != null) {
      length = clip.seconds * 1000;
    } else {
      length = math.max(shot.durationMs, audioTotal);
    }

    segments.add(RenderSegment(
      shotId: shot.id,
      kind: clip != null ? SegmentKind.clip : SegmentKind.still,
      path: clip?.videoPath ?? shot.imagePath!,
      startMs: cursor,
      durationMs: length,
      motion: shot.motion,
    ));

    var offset = cursor;
    for (final p in pieces) {
      audio.add(AudioEvent(path: p.path, offsetMs: offset, durationMs: p.ms, kind: p.kind, characterId: p.who));
      for (final c in splitCaptions(p.text, Duration(milliseconds: p.ms), maxCharsPerLine: captionMax)) {
        captions.add(Caption(startMs: offset + c.startMs, endMs: offset + c.endMs, text: c.text));
      }
      offset += p.ms;
    }
    cursor += length;
  }

  return RenderSpec(
    width: project.aspect.width,
    height: project.aspect.height,
    fps: fps,
    segments: segments,
    audioEvents: audio,
    captions: captions,
    grade: style.grade,
    language: project.contentLanguage,
    captionStyle: project.captionStyle,
    totalMs: cursor,
    sound: sound,
  );
}
