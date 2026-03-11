import { NextRequest, NextResponse } from 'next/server';
import { analyzeAudio } from '@/lib/gemini';

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

    const result = await analyzeAudio(base64Audio, mimeType);

    return NextResponse.json(result);
  } catch (e) {
    console.error('[transcribe]', e);
    const message = e instanceof Error ? e.message : '解析に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
