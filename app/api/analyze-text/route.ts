import { NextRequest, NextResponse } from 'next/server';
import { analyzeTranscript } from '@/lib/gemini';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'テキストが見つかりません' }, { status: 400 });
    }

    const result = await analyzeTranscript(transcript);

    return NextResponse.json(result);
  } catch (e) {
    console.error('[analyze-text]', e);
    const message = e instanceof Error ? e.message : '解析に失敗しました';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
