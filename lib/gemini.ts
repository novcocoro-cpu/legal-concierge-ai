import { GeminiResult } from '@/types';
import { createServerClient } from '@/lib/supabase';

const DEFAULT_MODEL = 'gemini-2.5-flash';

const PROMPT = `この会議音声を分析してください。
必ず以下のJSON形式のみで回答してください。
マークダウン記法（\`\`\`json等）、説明文、前置きは一切不要です。純粋なJSONのみ返してください。

{
  "title": "会議タイトル（内容から推測、20文字以内）",
  "transcript": "会議の文字起こし全文（複数話者の場合は「話者A：」等で区別）",
  "summary": "会議の要約（3〜5文）",
  "problems": ["問題点1", "問題点2", "問題点3"],
  "improvements": ["改善策1", "改善策2", "改善策3"],
  "action_plan": [
    {
      "task": "具体的なタスク内容",
      "assignee": "担当者名",
      "deadline": "YYYY-MM-DD",
      "priority": "high"
    }
  ],
  "next_meeting": {
    "suggested_timing": "例：2週間後",
    "agenda": ["議題1", "議題2"],
    "notes": "申し送り事項"
  }
}`;

async function getGeminiModel(): Promise<string> {
  try {
    const client = createServerClient();
    const { data } = await client
      .from('システム設定')
      .select('設定値')
      .eq('設定キー', 'gemini_model')
      .single();
    const row = data as Record<string, string> | null;
    return row?.['設定値'] || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

/** 音声チャンクから文字起こしのみ行う（分割送信用） */
export async function transcribeAudioOnly(base64Audio: string, mimeType: string): Promise<string> {
  const model = await getGeminiModel();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: 'この音声を文字起こししてください。話者が複数いる場合は「話者A：」等で区別してください。文字起こし結果のテキストのみを返してください。' }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/** テキストから会議分析を行う（チャンク結合後の解析用） */
export async function analyzeTranscript(transcript: string): Promise<GeminiResult> {
  const model = await getGeminiModel();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `以下は会議の文字起こしです。\n\n${transcript}\n\n${PROMPT}` }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned) as GeminiResult;
}

export async function analyzeAudio(base64Audio: string, mimeType: string): Promise<GeminiResult> {
  const model = await getGeminiModel();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: PROMPT }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  return JSON.parse(cleaned) as GeminiResult;
}
