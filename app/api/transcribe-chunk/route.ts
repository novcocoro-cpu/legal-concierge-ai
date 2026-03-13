import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudioOnly } from '@/lib/gemini';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: '音声ファイルが見つかりません' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = audioFile.type || 'audio/webm';

    const transcript = await transcribeAudioOnly(base64Audio, mimeType);

    return NextResponse.json({ transcript });
  } catch (e) {
    console.error('[transcribe-chunk]', e);
    const message = e instanceof Error ? e.message : '文字起こしに失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
