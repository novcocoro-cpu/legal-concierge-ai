import { GeminiResult } from '@/types';
import { createServerClient } from '@/lib/supabase';

const DEFAULT_TRANSCRIBE_MODEL = 'gemini-2.5-flash';
const DEFAULT_ANALYZE_MODEL = 'gemini-2.5-flash';

const DEFAULT_PROMPT = `あなたは経験豊富な弁護士アシスタントです。この法律相談の音声を分析してください。
必ず以下のJSON形式のみで回答してください。
マークダウン記法（\`\`\`json等）、説明文、前置きは一切不要です。純粋なJSONのみ返してください。

{
  "title": "案件名（内容から推測、20文字以内）",
  "transcript": "相談内容の文字起こし全文（複数話者の場合は「弁護士：」「相談者：」等で区別）",
  "summary": "本件は〜（相談内容の要約を「本件は」で始まる法律文書調の文体で3〜5文）",
  "problems": ["法的論点・争点1", "法的論点・争点2", "法的論点・争点3"],
  "improvements": ["対応方針1（証拠収集・交渉・訴訟等の具体的方針）", "対応方針2", "対応方針3"],
  "action_plan": [
    {
      "task": "宿題事項（証拠収集、書面作成、期日対応等）",
      "assignee": "担当弁護士名",
      "deadline": "YYYY-MM-DD",
      "priority": "high"
    }
  ],
  "next_meeting": {
    "suggested_timing": "例：2週間後",
    "agenda": ["次回期日の議題1", "次回期日の議題2"],
    "notes": "申し送り事項・期日管理メモ"
  },
  "litigation_risk": {
    "level": "高 or 中 or 低",
    "description": "訴訟リスクの総合評価（勝訴可能性、損害賠償リスク等を含む）",
    "factors": ["リスク要因1", "リスク要因2"]
  },
  "negotiation_strategy": {
    "approach": "交渉戦略の概要（強硬路線/協調路線/段階的エスカレーション等）",
    "psychological_notes": "相手方の心理的傾向・交渉上の注意点",
    "key_points": ["交渉ポイント1", "交渉ポイント2"]
  }
}`;

/** legal_prompts から最新プロンプトを取得 */
async function getCustomPrompt(): Promise<string> {
  try {
    const sb = createServerClient();
    if (!sb) return DEFAULT_PROMPT;
    const { data } = await sb.from('legal_prompts').select('content')
      .eq('key', 'legal_analysis').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return (data?.content as string) || DEFAULT_PROMPT;
  } catch {
    return DEFAULT_PROMPT;
  }
}

/** legal_prompts の model_settings からモデル名を取得 */
async function getModelSettings(): Promise<{ transcribe: string; analyze: string }> {
  try {
    const sb = createServerClient();
    if (!sb) return { transcribe: DEFAULT_TRANSCRIBE_MODEL, analyze: DEFAULT_ANALYZE_MODEL };
    const { data } = await sb.from('legal_prompts').select('content')
      .eq('key', 'model_settings').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.content) {
      const parsed = JSON.parse(data.content as string);
      return {
        transcribe: parsed.transcribe || DEFAULT_TRANSCRIBE_MODEL,
        analyze: parsed.analyze || DEFAULT_ANALYZE_MODEL,
      };
    }
  } catch { /* fallback */ }
  return { transcribe: DEFAULT_TRANSCRIBE_MODEL, analyze: DEFAULT_ANALYZE_MODEL };
}

/** 音声チャンクから文字起こしのみ行う（分割送信用） */
export async function transcribeAudioOnly(base64Audio: string, mimeType: string): Promise<string> {
  const { transcribe: model } = await getModelSettings();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: 'この音声を文字起こししてください。話者が複数いる場合は「弁護士：」「相談者：」等で区別してください。文字起こし結果のテキストのみを返してください。' }
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

/** テキストから法律分析を行う */
export async function analyzeTranscript(transcript: string): Promise<GeminiResult> {
  const { analyze: model } = await getModelSettings();
  const prompt = await getCustomPrompt();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `以下は法律相談の文字起こしです。\n\n${transcript}\n\n${prompt}` }
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
  const { analyze: model } = await getModelSettings();
  const prompt = await getCustomPrompt();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: prompt }
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
