'use client';

import { useCallback, useRef } from 'react';

// Google Picker API の型定義
declare global {
  interface Window {
    google?: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: { DOCS: string };
        Action: { PICKED: string; CANCEL: string };
        Feature: { MULTISELECT_ENABLED: string };
      };
    };
    gapi?: {
      load: (api: string, cb: (() => void) | { callback: () => void; onerror: () => void }) => void;
      client: {
        init: (config: { apiKey: string; discoveryDocs: string[] }) => Promise<void>;
        drive: {
          files: {
            get: (params: { fileId: string; alt: string }) => { then: (cb: (res: { body: string }) => void) => { catch: (cb: (e: Error) => void) => void } };
          };
        };
      };
    };
  }
}

interface GooglePickerBuilder {
  setOAuthToken: (token: string) => GooglePickerBuilder;
  addView: (view: unknown) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setCallback: (cb: (data: GooglePickerResult) => void) => GooglePickerBuilder;
  setTitle: (title: string) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface GooglePickerResult {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    mimeType: string;
    sizeBytes?: number;
  }>;
}

interface Props {
  disabled?: boolean;
  onFileSelected: (file: Blob, fileName: string) => void;
  onError: (message: string) => void;
  onProgress?: (step: string) => void;
}

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// 音声MIMEタイプ
const AUDIO_MIME_TYPES = [
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac',
  'audio/x-m4a', 'audio/m4a', 'video/mp4', 'video/webm',
];

function isAudioFile(mimeType: string): boolean {
  return AUDIO_MIME_TYPES.some(t => mimeType.startsWith(t.split('/')[0]) || mimeType === t);
}

/** Google API スクリプトを一度だけロード */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export default function GoogleDriveButton({ disabled, onFileSelected, onError, onProgress }: Props) {
  const tokenRef = useRef<string | null>(null);

  const getOAuthToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const goog = (window as any).google;
      if (!goog?.accounts?.oauth2?.initTokenClient) {
        reject(new Error('Google OAuth client not loaded'));
        return;
      }
      const tokenClient = goog.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (resp: { access_token?: string; error?: string }) => {
          if (resp.error) {
            console.error('[GoogleDrive] OAuth error:', resp.error);
            reject(new Error(`OAuth error: ${resp.error}`));
          } else if (resp.access_token) {
            console.log('[GoogleDrive] OAuth token obtained');
            tokenRef.current = resp.access_token;
            resolve(resp.access_token);
          } else {
            console.error('[GoogleDrive] OAuth: no token and no error', resp);
            reject(new Error('OAuth認証に失敗しました（トークンが取得できません）'));
          }
        },
        error_callback: (err: { type: string; message?: string }) => {
          console.error('[GoogleDrive] OAuth error_callback:', err);
          reject(new Error(
            err.type === 'popup_closed'
              ? '認証ポップアップが閉じられました'
              : `OAuth error: ${err.type} ${err.message || ''}`
          ));
        },
      });
      tokenClient.requestAccessToken();
      /* eslint-enable @typescript-eslint/no-explicit-any */
    });
  }, []);

  const downloadFile = useCallback(async (fileId: string, accessToken: string): Promise<Blob> => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      throw new Error(`Google Driveからのダウンロードに失敗しました（${res.status}）`);
    }
    return res.blob();
  }, []);

  const openPicker = useCallback(async () => {
    if (!GOOGLE_API_KEY || !GOOGLE_CLIENT_ID) {
      onError('Google API キーまたはクライアントIDが設定されていません。\n.env.local に NEXT_PUBLIC_GOOGLE_API_KEY と NEXT_PUBLIC_GOOGLE_CLIENT_ID を設定してください。');
      return;
    }

    try {
      onProgress?.('Google Drive を準備中…');

      // Google API スクリプトをロード
      await Promise.all([
        loadScript('https://apis.google.com/js/api.js'),
        loadScript('https://accounts.google.com/gsi/client'),
      ]);

      // Picker API ロード
      await new Promise<void>((resolve, reject) => {
        if (!window.gapi) {
          reject(new Error('Google API (gapi) が読み込まれませんでした'));
          return;
        }
        window.gapi.load('picker', {
          callback: resolve,
          onerror: () => reject(new Error('Google Picker API の読み込みに失敗しました')),
        });
      });

      console.log('[GoogleDrive] Picker API loaded, google.picker:', !!window.google?.picker);

      if (!window.google?.picker) {
        throw new Error('Google Picker API が利用できません。Google Cloud Console で Picker API を有効にしてください。');
      }

      // OAuth トークン取得
      const accessToken = tokenRef.current || await getOAuthToken();
      console.log('[GoogleDrive] Building picker...');

      // Picker 表示
      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_API_KEY)
        .addView(window.google.picker.ViewId.DOCS)
        .setTitle('音声ファイルを選択')
        .setCallback(async (data: GooglePickerResult) => {
          console.log('[GoogleDrive] Picker callback:', data.action);
          if (data.action === window.google!.picker.Action.PICKED && data.docs?.length) {
            const doc = data.docs[0];

            // 音声ファイルかチェック
            if (!isAudioFile(doc.mimeType)) {
              onError(`音声ファイルを選択してください。\n選択されたファイル: ${doc.name} (${doc.mimeType})`);
              return;
            }

            try {
              onProgress?.('Google Driveからダウンロード中…');
              const blob = await downloadFile(doc.id, accessToken);
              onFileSelected(blob, doc.name);
            } catch (e) {
              onError(e instanceof Error ? e.message : 'ファイルのダウンロードに失敗しました');
            }
          }
        })
        .build();

      picker.setVisible(true);
      console.log('[GoogleDrive] Picker shown');
    } catch (e) {
      console.error('[GoogleDrive] Error:', e);
      onError(e instanceof Error ? e.message : 'Google Driveの読み込みに失敗しました');
    }
  }, [onFileSelected, onError, onProgress, getOAuthToken, downloadFile]);

  return (
    <button
      onClick={openPicker}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
      style={{
        background: 'var(--surface)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/>
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.4 13.8z" fill="#ea4335"/>
        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
        <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
      </svg>
      Googleドライブから読み込む
    </button>
  );
}
