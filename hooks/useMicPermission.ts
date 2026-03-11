'use client';

import { useState, useEffect, useCallback } from 'react';

export type MicStatus = 'checking' | 'granted' | 'denied' | 'prompt' | 'unavailable';

export function useMicPermission() {
  const [status, setStatus] = useState<MicStatus>('checking');

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    // getUserMedia 自体が使えない環境（HTTP、古いブラウザ）
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }

    // Permissions API で現在の許可状態を確認（リクエストは発生しない）
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((result) => {
          const toStatus = (s: string): MicStatus =>
            s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
          setStatus(toStatus(result.state));
          // 許可状態が変わったらリアルタイム反映
          result.addEventListener('change', () => {
            setStatus(toStatus(result.state));
          });
        })
        .catch(() => {
          // iOS Safari など Permissions API が microphone に未対応の場合
          setStatus('prompt');
        });
    } else {
      // Permissions API 自体が存在しない（古いSafari等）
      setStatus('prompt');
    }
  }, []);

  /**
   * ユーザーのタップ操作の中から呼ぶこと（ユーザージェスチャーが必要）
   * getUserMedia を発行してOSのマイク許可ダイアログを表示する
   */
  const requestPermission = useCallback(async (): Promise<MicStatus> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 許可確認のためだけなので即停止
      stream.getTracks().forEach((t) => t.stop());
      setStatus('granted');
      return 'granted';
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setStatus('unavailable');
        return 'unavailable';
      }
      // NotAllowedError / PermissionDeniedError / SecurityError など
      setStatus('denied');
      return 'denied';
    }
  }, []);

  return { status, requestPermission };
}
