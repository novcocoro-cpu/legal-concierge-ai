'use client';

import { useState, useEffect } from 'react';
import { loadHistory, deleteHistoryEntry, type HistoryEntry } from '@/lib/localHistory';
import { GeminiResult } from '@/types';

const DEFAULT_PROMPT = `あなたは経験豊富な弁護士アシスタントです。この法律相談の音声を分析してください。`;

const MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash', label: 'Gemini Flash-Lite', desc: '高速・低コスト' },
  { id: 'gemini-2.5-pro', label: 'Gemini Pro', desc: '高精度・標準' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet', desc: '最高精度' },
];

type Tab = 'dashboard' | 'models' | 'prompt' | 'history';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [transcribeModel, setTranscribeModel] = useState('gemini-2.5-flash');
  const [analyzeModel, setAnalyzeModel] = useState('gemini-2.5-flash');
  const [prompt, setPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setPrompt(localStorage.getItem('legal_custom_prompt') || DEFAULT_PROMPT);
    setTranscribeModel(localStorage.getItem('legal_transcribe_model') || 'gemini-2.5-flash');
    setAnalyzeModel(localStorage.getItem('legal_analyze_model') || 'gemini-2.5-flash');
  }, []);

  const filteredHistory = searchQuery
    ? history.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.caseName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;

  const thisMonth = history.filter(e => {
    const d = new Date(e.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const handleDeleteEntry = (id: string) => {
    deleteHistoryEntry(id);
    setHistory(loadHistory());
    if (selectedEntry?.id === id) setSelectedEntry(null);
  };

  const handleSavePrompt = () => {
    localStorage.setItem('legal_custom_prompt', prompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const handleSaveModels = () => {
    localStorage.setItem('legal_transcribe_model', transcribeModel);
    localStorage.setItem('legal_analyze_model', analyzeModel);
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: '統計', icon: '📊' },
    { id: 'models', label: 'AIモデル', icon: '🤖' },
    { id: 'prompt', label: 'プロンプト', icon: '📝' },
    { id: 'history', label: '履歴', icon: '📋' },
  ];

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* サイドバー */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: 'var(--navy-deep)', borderRight: '1px solid var(--border)' }}>
        <div className="p-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-2xl">⚖️</span>
          <h1 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-sm font-bold">管理画面</h1>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedEntry(null); }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
              style={{
                background: tab === t.id ? 'var(--accent-dim)' : 'transparent',
                color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <a href="/record" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ color: 'var(--muted)' }}>
            ← 録音画面に戻る
          </a>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ── ダッシュボード ── */}
        {tab === 'dashboard' && (
          <div>
            <h2 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-xl font-bold mb-6">ダッシュボード</h2>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <StatCard label="今月の件数" value={`${thisMonth.length}件`} icon="📊" />
              <StatCard label="全期間の件数" value={`${history.length}件`} icon="📁" />
              <StatCard label="今月の録音時間" value={`${Math.round(thisMonth.reduce((s, e) => s + e.durationSec, 0) / 60)}分`} icon="⏱" />
            </div>
            <h3 style={{ color: 'var(--text)' }} className="text-sm font-semibold mb-3">最近の相談</h3>
            <div className="flex flex-col gap-2">
              {history.slice(0, 5).map(e => (
                <div key={e.id} className="card-legal p-3 flex items-center justify-between">
                  <div>
                    <p style={{ color: 'var(--text)' }} className="text-sm font-medium">{e.title}</p>
                    <p style={{ color: 'var(--muted)' }} className="text-xs">{formatDate(e.createdAt)} | {e.caseName}</p>
                  </div>
                  <button onClick={() => { setTab('history'); setSelectedEntry(e); }}
                    className="text-xs px-3 py-1 rounded-lg" style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}>
                    詳細
                  </button>
                </div>
              ))}
              {history.length === 0 && <p style={{ color: 'var(--muted)' }} className="text-sm">まだヒアリング記録がありません</p>}
            </div>
          </div>
        )}

        {/* ── AIモデル設定 ── */}
        {tab === 'models' && (
          <div>
            <h2 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-xl font-bold mb-6">AIモデル設定</h2>
            <div className="flex flex-col gap-6 max-w-lg">
              <div>
                <label style={{ color: 'var(--accent)' }} className="text-sm font-semibold mb-3 block">文字起こし用モデル</label>
                <div className="flex flex-col gap-2">
                  {MODEL_OPTIONS.map(m => (
                    <button key={m.id} onClick={() => setTranscribeModel(m.id)}
                      className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: transcribeModel === m.id ? 'var(--accent-dim)' : 'var(--surface)',
                        border: transcribeModel === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      }}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: transcribeModel === m.id ? 'var(--accent)' : 'var(--muted)' }}>
                        {transcribeModel === m.id && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
                      </div>
                      <div>
                        <p style={{ color: 'var(--text)' }} className="text-sm font-medium">{m.label}</p>
                        <p style={{ color: 'var(--muted)' }} className="text-xs">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ color: 'var(--accent)' }} className="text-sm font-semibold mb-3 block">分析用モデル</label>
                <div className="flex flex-col gap-2">
                  {MODEL_OPTIONS.map(m => (
                    <button key={m.id} onClick={() => setAnalyzeModel(m.id)}
                      className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: analyzeModel === m.id ? 'var(--accent-dim)' : 'var(--surface)',
                        border: analyzeModel === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      }}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: analyzeModel === m.id ? 'var(--accent)' : 'var(--muted)' }}>
                        {analyzeModel === m.id && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
                      </div>
                      <div>
                        <p style={{ color: 'var(--text)' }} className="text-sm font-medium">{m.label}</p>
                        <p style={{ color: 'var(--muted)' }} className="text-xs">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveModels}
                className="py-2.5 px-6 rounded-xl text-sm font-semibold self-start"
                style={{ background: 'var(--gold-grad)', color: '#0a1628' }}>
                設定を保存
              </button>
            </div>
          </div>
        )}

        {/* ── プロンプト編集 ── */}
        {tab === 'prompt' && (
          <div>
            <h2 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-xl font-bold mb-6">AIプロンプト編集</h2>
            <div className="max-w-2xl">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={16}
                className="w-full p-4 rounded-xl text-sm outline-none resize-y leading-relaxed"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: "'Noto Sans JP', sans-serif" }}
              />
              <div className="flex items-center gap-3 mt-4">
                <button onClick={handleSavePrompt}
                  className="py-2.5 px-6 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--gold-grad)', color: '#0a1628' }}>
                  保存
                </button>
                <button onClick={() => { setPrompt(DEFAULT_PROMPT); }}
                  className="py-2.5 px-6 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  デフォルトに戻す
                </button>
                {promptSaved && <span style={{ color: 'var(--success)' }} className="text-sm font-medium">保存しました</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── 履歴 ── */}
        {tab === 'history' && !selectedEntry && (
          <div>
            <h2 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-xl font-bold mb-4">ヒアリング履歴</h2>
            <input type="text" placeholder="案件名・タイトルで検索…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 rounded-xl text-sm outline-none mb-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <div className="flex flex-col gap-2">
              {filteredHistory.map(e => (
                <div key={e.id} className="card-legal p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-3 cursor-pointer" onClick={() => setSelectedEntry(e)}>
                    <p style={{ color: 'var(--text)' }} className="text-sm font-medium truncate">{e.title}</p>
                    <p style={{ color: 'var(--muted)' }} className="text-xs">{formatDate(e.createdAt)} | {e.caseName} | {e.userName}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedEntry(e)} className="text-xs px-3 py-1 rounded-lg" style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}>詳細</button>
                    <button onClick={() => handleDeleteEntry(e.id)} className="text-xs px-3 py-1 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(248,81,73,0.1)' }}>削除</button>
                  </div>
                </div>
              ))}
              {filteredHistory.length === 0 && <p style={{ color: 'var(--muted)' }} className="text-sm py-8 text-center">該当する記録がありません</p>}
            </div>
          </div>
        )}

        {/* ── 履歴詳細 ── */}
        {tab === 'history' && selectedEntry && (
          <HistoryDetail entry={selectedEntry} onBack={() => setSelectedEntry(null)} />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="card-legal p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'var(--accent-dim)' }}>
        {icon}
      </div>
      <div>
        <p style={{ color: 'var(--muted)' }} className="text-xs">{label}</p>
        <p style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function HistoryDetail({ entry, onBack }: { entry: HistoryEntry; onBack: () => void }) {
  const r: GeminiResult = entry.result;
  const PRIORITY_JA: Record<string, string> = { high: '高', medium: '中', low: '低' };

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm mb-4 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
        ← 一覧に戻る
      </button>
      <div className="card-legal p-4 mb-4">
        <h2 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-lg font-bold">{r.title}</h2>
        <p style={{ color: 'var(--muted)' }} className="text-xs mt-1">
          {formatDate(entry.createdAt)} | {entry.caseName} | {entry.userName} | {entry.companyName}
        </p>
      </div>
      <Section title="📄 相談内容の要約">{r.summary}</Section>
      <Section title="⚠️ 法的論点・争点">
        <ul>{r.problems?.map((p, i) => <li key={i} className="text-sm mb-1" style={{ color: 'var(--text)' }}>• {p}</li>)}</ul>
      </Section>
      <Section title="💡 対応方針">
        <ul>{r.improvements?.map((imp, i) => <li key={i} className="text-sm mb-1" style={{ color: 'var(--text)' }}>• {imp}</li>)}</ul>
      </Section>
      {r.litigation_risk && (
        <Section title="🔥 訴訟リスク評価">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full mr-2" style={{
            background: r.litigation_risk.level === '高' ? 'var(--danger)' : r.litigation_risk.level === '中' ? 'var(--warning)' : 'var(--success)', color: '#fff'
          }}>{r.litigation_risk.level}</span>
          <span className="text-sm" style={{ color: 'var(--text)' }}>{r.litigation_risk.description}</span>
        </Section>
      )}
      {r.negotiation_strategy && (
        <Section title="🧠 交渉戦略">
          <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>{r.negotiation_strategy.approach}</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{r.negotiation_strategy.psychological_notes}</p>
        </Section>
      )}
      <Section title="🎯 宿題事項">
        {r.action_plan?.map((a, i) => (
          <div key={i} className="text-sm mb-2 p-2 rounded-lg" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
            {a.task} — 担当: {a.assignee} / 期限: {a.deadline} / 優先度: {PRIORITY_JA[a.priority] ?? a.priority}
          </div>
        ))}
      </Section>
      {r.transcript && (
        <Section title="📝 文字起こし">
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{r.transcript}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-legal p-4 mb-3">
      <h3 style={{ color: 'var(--accent)', fontFamily: "'Noto Serif JP', serif" }} className="text-xs font-bold uppercase tracking-widest mb-2">{title}</h3>
      <div style={{ color: 'var(--text)' }} className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
