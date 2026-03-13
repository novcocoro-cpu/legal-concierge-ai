'use client';

import { useState, useRef, useCallback } from 'react';

const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function getSupportedMimeType(): string {
  for (const type of MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  seconds:     number;
  startRecording: () => Promise<void>;
  stopRecording:  () => Promise<Blob>;
  getSnapshot:    () => { chunks: Blob[]; mimeType: string } | null;
  error:       string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds]         = useState(0);
  const [error, setError]             = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef       = useRef<((blob: Blob) => void) | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mr = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 16000, // 16kbps — 音声通話品質で十分、ファイルサイズ大幅削減
      });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.start(100);
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '録音を開始できませんでした';
      setError(msg);
      throw e;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      const mr = mediaRecorderRef.current;
      if (!mr) {
        resolve(new Blob());
        return;
      }

      mr.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const mimeType = mr.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        mr.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };

      mr.stop();
    });
  }, []);

  /** 録音中の現在チャンクをスナップショットとして返す（バックアップ用） */
  const getSnapshot = useCallback((): { chunks: Blob[]; mimeType: string } | null => {
    const mr = mediaRecorderRef.current;
    if (!mr || !isRecording) return null;
    return {
      chunks:   [...chunksRef.current],
      mimeType: mr.mimeType || 'audio/webm',
    };
  }, [isRecording]);

  return { isRecording, seconds, startRecording, stopRecording, getSnapshot, error };
}
