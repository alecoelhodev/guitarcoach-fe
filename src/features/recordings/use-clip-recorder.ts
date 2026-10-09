import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { MAX_CLIP_SECONDS } from '@/features/recordings/clip-limit';
import type { Clip } from '@/features/recordings/pick-recording';

export type RecorderStatus = 'idle' | 'recording' | 'denied' | 'failed';

const POLL_MS = 250;

/**
 * HIGH_QUALITY writes AAC in an `.m4a` on iOS and Android and WebM in a browser. The m4a is sent
 * as `audio/mp4`: bare `audio/m4a` is not on the backend's allow-list.
 */
async function toClip(uri: string, seconds: number): Promise<Clip> {
  const web = process.env.EXPO_OS === 'web';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    file: {
      uri,
      name: `recording-${stamp}.${web ? 'webm' : 'm4a'}`,
      mimeType: web ? 'audio/webm' : 'audio/mp4',
      file: web ? await (await fetch(uri)).blob() : undefined,
    },
    seconds,
  };
}

/**
 * Records one clip of at most `MAX_CLIP_SECONDS`. The cap is a timer here rather than
 * `record({ forDuration })`: a native stop would leave this hook believing it is still
 * recording, with no clip handed over.
 */
export function useClipRecorder(onClip: (clip: Clip) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, POLL_MS);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const stopping = useRef(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function start() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setStatus('denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
      capTimer.current = setTimeout(() => void latestStop.current(), MAX_CLIP_SECONDS * 1000);
    } catch {
      setStatus('failed');
    }
  }

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    clearTimeout(capTimer.current);
    const seconds = Math.min(
      Math.round(recorder.getStatus().durationMillis / 1000),
      MAX_CLIP_SECONDS,
    );
    try {
      await recorder.stop();
      // iOS routes playback to the earpiece while recording is allowed.
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error('The recorder produced no file');
      onClip(await toClip(recorder.uri, seconds));
      setStatus('idle');
    } catch {
      setStatus('failed');
    } finally {
      stopping.current = false;
    }
  }

  // The cap timer fires long after the render that armed it, so it calls the newest `stop`,
  // whose `onClip` is the caller's current one.
  const latestStop = useRef(stop);
  useEffect(() => {
    latestStop.current = stop;
  });
  useEffect(() => () => clearTimeout(capTimer.current), []);

  return {
    status,
    seconds: Math.min(Math.floor(state.durationMillis / 1000), MAX_CLIP_SECONDS),
    start,
    stop,
  };
}
