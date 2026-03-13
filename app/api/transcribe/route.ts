import { NextRequest, NextResponse } from 'next/server';
import { analyzeAudio, transcribeAudioOnly, analyzeTranscript } from '@/lib/gemini';
import { createServerClient } from '@/lib/supabase';

export const maxDuration = 120;

const STORAGE_BUCKET = 'audio-uploads';
// Gemini inline_data 上限を考慮し、raw 8MB 超は分割して文字起こし
const CHUNK_RAW_SIZE = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { storagePath, mimeType } = await req.json();
    if (!storagePath) {
      return NextResponse.json({ error: 'storagePath が必要です' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw new Error(`Storage download error: ${error?.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    const mime = mimeType || 'audio/webm';

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
      const result = await analyzeTranscript(combined);
      return NextResponse.json(result);
    }

    // 小さめなら一括処理
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const result = await analyzeAudio(base64Audio, mime);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[transcribe]', e);
    const message = e instanceof Error ? e.message : '解析に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
