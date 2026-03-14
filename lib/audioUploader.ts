'use client';

import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GeminiResult } from '@/types';

const STORAGE_BUCKET = 'audio-uploads';

/**
 * 音声 Blob を文字起こし・解析する。
 * Supabase が設定されている場合は Storage 経由、
 * 未設定の場合は base64 で直接 API に送信する。
 */
export async function uploadAndTranscribe(
  blob: Blob,
  onProgress?: (step: string) => void,
): Promise<GeminiResult> {
  const supabase = createSupabaseBrowser();

  // Supabase が利用可能な場合は Storage 経由
  if (supabase) {
    const filename = `recording_${Date.now()}.webm`;
    const storagePath = `recordings/${filename}`;

    onProgress?.('Supabase Storageにアップロード中…');

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, blob, {
        contentType: blob.type || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Supabase Storageアップロードエラー: ${uploadError.message}`);
    }

    try {
      onProgress?.('文字起こし中…');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, mimeType: blob.type || 'audio/webm' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `文字起こしエラー（HTTPエラー ${res.status}）`);
      }

      onProgress?.('解析完了！');
      return res.json();
    } finally {
      supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
    }
  }

  // Supabase 未設定の場合は base64 で直接送信
  onProgress?.('音声データを変換中…');
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  onProgress?.('文字起こし中…');

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64: base64, mimeType: blob.type || 'audio/webm' }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `文字起こしエラー（HTTPエラー ${res.status}）`);
  }

  onProgress?.('解析完了！');
  return res.json();
}
