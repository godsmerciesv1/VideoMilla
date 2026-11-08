import 'package:flutter/foundation.dart';

import '../models/character_profile.dart';
import '../models/shot.dart';
import 'animation_planner.dart' show maxTalkingMs;

/// How a shot's words are delivered.
enum ShotAudioMode {
  /// The narrator reads the shot's narration.
  narration,

  /// An animated shot whose single line is lip-synced from that character's audio.
  talking,

  /// Lines played in the characters' voices over a picture with motion (not animated,
  /// longer than 8 seconds, mixed with narration, or lip-sync failed).
  voiceOver,
}

/// One voice file the shot needs before clips are submitted or the video is rendered.
@immutable
class AudioNeed {
  const AudioNeed({
    required this.shotId,
    required this.text,
    this.characterId,
    this.voiceId,
    this.fallbackToNarrator = false,
  });

  final String shotId;
  final String text;

  /// The speaking character, or null for the narrator.
  final String? characterId;

  /// The voice to use; null means the caller picks the language default.
  final String? voiceId;

  /// The line named a speaker who is not a known character, so the narrator reads it.
  final bool fallbackToNarrator;
}

@immutable
class ShotDialoguePlan {
  const ShotDialoguePlan({required this.shotId, required this.mode, required this.needs});

  final String shotId;
  final ShotAudioMode mode;

  /// In playing order. Voices never overlap.
  final List<AudioNeed> needs;
}

/// Decides, shot by shot, whether words are narrated, lip-synced (talking) or played
/// as a voice-over, and which voice speaks each one (blueprint Section 5.7).
///
/// A talking shot needs: animated, exactly one line, no narration, line audio of at most
/// 8 seconds (when its length is not known yet it is assumed to fit; plan again after
/// synthesizing), and no earlier lip-sync failure.
List<ShotDialoguePlan> planDialogue({
  required List<Shot> shots,
  required List<CharacterProfile> characters,
  required String? narratorVoiceId,
  Set<String> animatedShotIds = const <String>{},
  Set<String> lipSyncFailed = const <String>{},
}) {
  final byId = <String, CharacterProfile>{for (final c in characters) c.id: c};
  final ordered = List<Shot>.of(shots)..sort((a, b) => a.order.compareTo(b.order));

  AudioNeed narrator(Shot s, String text) =>
      AudioNeed(shotId: s.id, text: text, voiceId: narratorVoiceId);

  AudioNeed spoken(Shot s, SpeakerLine line) {
    final c = byId[line.characterId];
    if (c == null) {
      return AudioNeed(shotId: s.id, text: line.text, voiceId: narratorVoiceId, fallbackToNarrator: true);
    }
    return AudioNeed(shotId: s.id, text: line.text, characterId: c.id, voiceId: c.voiceId ?? narratorVoiceId);
  }

  final out = <ShotDialoguePlan>[];
  for (final s in ordered) {
    if (s.lines.isEmpty) {
      out.add(ShotDialoguePlan(
        shotId: s.id,
        mode: ShotAudioMode.narration,
        needs: s.narration.trim().isEmpty ? const <AudioNeed>[] : <AudioNeed>[narrator(s, s.narration)],
      ));
      continue;
    }
    final line = s.lines.first;
    final knownSpeaker = byId.containsKey(line.characterId);
    final fits = (line.audioMs ?? 0) <= maxTalkingMs;
    final talking = s.isTalkingCandidate &&
        knownSpeaker &&
        animatedShotIds.contains(s.id) &&
        fits &&
        !lipSyncFailed.contains(s.id);
    if (talking) {
      out.add(ShotDialoguePlan(shotId: s.id, mode: ShotAudioMode.talking, needs: <AudioNeed>[spoken(s, line)]));
      continue;
    }
    out.add(ShotDialoguePlan(
      shotId: s.id,
      mode: ShotAudioMode.voiceOver,
      needs: <AudioNeed>[
        if (s.narration.trim().isNotEmpty) narrator(s, s.narration),
        for (final l in s.lines) spoken(s, l),
      ],
    ));
  }
  return out;
}
