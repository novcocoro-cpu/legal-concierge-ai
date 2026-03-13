'use client';

import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { GeminiResult } from '@/types';

const STORAGE_BUCKET = 'audio-uploads';

/**
 * 音声 Blob を Supabase Storage にアップロードし、
 * サーバー側で Storage からダウンロード → Gemini API で文字起こし・解析する。
 *
 * Vercel の 4.5MB body 制限を完全回避するため、
 * すべてのファイルを Supabase Storage 経由で処理する。
 */
export async function uploadAndTranscribe(
  blob: Blob,
  onProgress?: (step: string) => void,
): Promise<GeminiResult> {
  const supabase = createSupabaseBrowser();
  const filename = `recording_${Date.now()}.webm`;
  const storagePath = `recordings/${filename}`;

  // ① Supabase Storage にアップロード
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

  // ② サーバーに storagePath を送信 → サーバーが Storage からDL → Gemini で解析
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
    // ③ 処理完了後にストレージから削除（成功・失敗問わず）
    supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {});
  }
}
