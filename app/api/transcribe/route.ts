import { NextRequest, NextResponse } from 'next/server';
import { analyzeAudio, transcribeAudioOnly, analyzeTranscript } from '@/lib/gemini';
import { createServerClient } from '@/lib/supabase';

export const maxDuration = 120;

const STORAGE_BUCKET = 'audio-uploads';
// Gemini inline_data 上限を考慮し、raw 8MB 超は分割して文字起こし
const CHUNK_RAW_SIZE = 8 * 1024 * 1024;

async function processAudio(arrayBuffer: ArrayBuffer, mime: string) {
  // 大きいファイルは分割して文字起こし → 結合 → 解析
  if (arrayBuffer.byteLength > CHUNK_RAW_SIZE) {
    const transcripts: string[] = [];
    let offset = 0;
    while (offset < arrayBuffer.byteLength) {
      const end = Math.min(offset + CHUNK_RAW_SIZE, arrayBuffer.byteLength);
      const chunkBase64 = Buffer.from(arrayBuffer.slice(offset, end)).toString('base64');
      const text = await transcribeAudioOnly(chunkBase64, mime);
      if (text.trim()) transcripts.push(text);
      offset = end;
    }
    const combined = transcripts.join('\n\n');
    return analyzeTranscript(combined);
  }

  // 小さめなら一括処理
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');
  return analyzeAudio(base64Audio, mime);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storagePath, audioBase64, mimeType } = body;
    const mime = mimeType || 'audio/webm';

    // パターン1: Supabase Storage 経由
    if (storagePath) {
      const supabase = createServerClient();
      if (!supabase) {
        return NextResponse.json({ error: 'Supabase が設定されていません' }, { status: 500 });
      }
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(storagePath);

      if (error || !data) {
        throw new Error(`Storage download error: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      const result = await processAudio(arrayBuffer, mime);
      return NextResponse.json(result);
    }

    // パターン2: base64 直接送信（Supabase 未設定時）
    if (audioBase64) {
      const buffer = Buffer.from(audioBase64, 'base64');
      const result = await processAudio(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), mime);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'storagePath または audioBase64 が必要です' }, { status: 400 });
  } catch (e) {
    console.error('[transcribe]', e);
    const message = e instanceof Error ? e.message : '解析に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
