'use client';

import { useState, useEffect, useCallback } from 'react';

const DEFAULT_PROMPT = `あなたは経験豊富な弁護士アシスタントです。この法律相談の音声を分析してください。
必ず以下のJSON形式のみで回答してください。マークダウン記法は不要です。純粋なJSONのみ返してください。`;

const TRANSCRIBE_MODELS = [
  { id: 'gemini-2.0-flash-lite', label: 'Gemini Flash-Lite', desc: '高速・低コスト' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: '標準・バランス型' },
];
const ANALYZE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash（デフォルト）', desc: 'Gemini 標準' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: '高精度' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', desc: '最高精度' },
];

type Tab = 'prompt' | 'models' | 'users' | 'history';
interface Hearing { id:string; case_name:string; summary:string; risk_level:string; created_at:string; user_id:string; }
interface LegalUser { id:string; name:string; role:string; firm_id:string; created_at:string; }

function fmtDate(iso:string) { return new Date(iso).toLocaleDateString('ja-JP',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('prompt');
  const [firmId, setFirmId] = useState<string|null>(null);

  // Prompt state
  const [prompt, setPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);

  // Model state
  const [transcribeModel, setTranscribeModel] = useState('gemini-2.5-flash');
  const [analyzeModel, setAnalyzeModel] = useState('gemini-2.5-flash');
  const [modelSaved, setModelSaved] = useState(false);

  // Users state
  const [users, setUsers] = useState<LegalUser[]>([]);
  const [newUserName, setNewUserName] = useState('');

  // History state
  const [hearings, setHearings] = useState<Hearing[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedHearing, setSelectedHearing] = useState<Record<string,any>|null>(null);

  // Init: get/create firm
  useEffect(() => {
    const firmName = typeof window!=='undefined' ? localStorage.getItem('mtg_company') || '法律事務所' : '法律事務所';
    fetch('/api/legal/firms', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:firmName}) })
      .then(r=>r.json()).then(f=>{ if(f.id) setFirmId(f.id); }).catch(()=>{});
  }, []);

  // Load data when firmId or tab changes
  const loadPrompt = useCallback(()=>{
    if(!firmId) return;
    fetch(`/api/legal/prompts?firm_id=${firmId}&key=legal_analysis`).then(r=>r.json()).then(d=>{ if(d.content) setPrompt(d.content); else setPrompt(DEFAULT_PROMPT); });
    fetch(`/api/legal/prompts?firm_id=${firmId}&key=model_settings`).then(r=>r.json()).then(d=>{
      if(d.content) { try { const m=JSON.parse(d.content); setTranscribeModel(m.transcribe||'gemini-2.5-flash'); setAnalyzeModel(m.analyze||'gemini-2.5-flash'); } catch{} }
    });
  },[firmId]);

  const loadUsers = useCallback(()=>{
    if(!firmId) return;
    fetch(`/api/legal/users?firm_id=${firmId}`).then(r=>r.json()).then(setUsers).catch(()=>{});
  },[firmId]);

  const loadHearings = useCallback(()=>{
    if(!firmId) return;
    fetch(`/api/legal/hearings?firm_id=${firmId}`).then(r=>r.json()).then(setHearings).catch(()=>{});
  },[firmId]);

  useEffect(()=>{ loadPrompt(); loadUsers(); loadHearings(); },[loadPrompt,loadUsers,loadHearings]);

  // Handlers
  const savePrompt = async () => {
    if(!firmId) return;
    await fetch('/api/legal/prompts',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({firm_id:firmId,key:'legal_analysis',content:prompt})});
    setPromptSaved(true); setTimeout(()=>setPromptSaved(false),2000);
  };

  const saveModels = async () => {
    if(!firmId) return;
    await fetch('/api/legal/prompts',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({firm_id:firmId,key:'model_settings',content:JSON.stringify({transcribe:transcribeModel,analyze:analyzeModel})})});
    setModelSaved(true); setTimeout(()=>setModelSaved(false),2000);
  };

  const addUser = async () => {
    if(!firmId||!newUserName.trim()) return;
    await fetch('/api/legal/users',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({firm_id:firmId,name:newUserName.trim(),role:'user'})});
    setNewUserName(''); loadUsers();
  };

  const deleteUser = async (id:string) => {
    await fetch(`/api/legal/users?id=${id}`,{method:'DELETE'}); loadUsers();
  };

  const deleteHearing = async (id:string) => {
    await fetch(`/api/legal/hearings?id=${id}`,{method:'DELETE'}); loadHearings(); setSelectedHearing(null);
  };

  const TABS:{id:Tab;label:string;icon:string}[] = [
    {id:'prompt',label:'プロンプト',icon:'📝'},
    {id:'models',label:'AIモデル',icon:'🤖'},
    {id:'users',label:'ユーザー',icon:'👥'},
    {id:'history',label:'履歴',icon:'📋'},
  ];

  const sideStyle = {background:'var(--navy-deep)',borderRight:'1px solid var(--gold-border)'};
  const goldTitle = {color:'var(--gold2)',fontFamily:"'Noto Serif JP',serif"};

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'var(--navy)'}}>
      {/* Sidebar */}
      <aside style={{...sideStyle,width:200,flexShrink:0,display:'flex',flexDirection:'column'}}>
        <div style={{padding:16,borderBottom:'1px solid var(--gold-border)',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:20}}>⚖️</span>
          <h1 style={{...goldTitle,fontSize:13,fontWeight:600}}>管理画面</h1>
        </div>
        <nav style={{flex:1,padding:8,display:'flex',flexDirection:'column',gap:4}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setSelectedHearing(null);}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:8,fontSize:13,fontWeight:500,
                background:tab===t.id?'var(--gold-dim)':'transparent',color:tab===t.id?'var(--gold2)':'var(--text-muted)',
                border:'none',cursor:'pointer',textAlign:'left',fontFamily:"'Noto Sans JP',sans-serif"}}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
        <div style={{padding:12,borderTop:'1px solid var(--gold-border)'}}>
          <a href="/record" style={{fontSize:11,color:'var(--text-muted)',textDecoration:'none'}}>← 録音画面に戻る</a>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,overflowY:'auto',padding:24}}>

        {/* ── プロンプト ── */}
        {tab==='prompt'&&(
          <div>
            <h2 style={{...goldTitle,fontSize:18,fontWeight:600,marginBottom:20}}>AIプロンプト編集</h2>
            <div style={{maxWidth:700}}>
              <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={18}
                style={{width:'100%',padding:16,borderRadius:10,fontSize:13,outline:'none',resize:'vertical',lineHeight:1.8,
                  background:'var(--surface)',border:'1px solid var(--gold-border)',color:'var(--text-primary)',fontFamily:"'Noto Sans JP',sans-serif"}}/>
              <div style={{display:'flex',alignItems:'center',gap:12,marginTop:12}}>
                <button onClick={savePrompt} style={{padding:'8px 24px',borderRadius:8,fontSize:13,fontWeight:600,
                  background:'linear-gradient(145deg,var(--gold2),#a8832e)',color:'var(--navy)',border:'none',cursor:'pointer'}}>保存</button>
                <button onClick={()=>setPrompt(DEFAULT_PROMPT)} style={{padding:'8px 24px',borderRadius:8,fontSize:13,
                  background:'transparent',color:'var(--text-muted)',border:'1px solid var(--gold-border)',cursor:'pointer'}}>デフォルトに戻す</button>
                {promptSaved&&<span style={{color:'var(--success)',fontSize:13,fontWeight:500}}>保存しました</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── AIモデル ── */}
        {tab==='models'&&(
          <div>
            <h2 style={{...goldTitle,fontSize:18,fontWeight:600,marginBottom:20}}>AIモデル設定</h2>
            <div style={{maxWidth:500,display:'flex',flexDirection:'column',gap:24}}>
              <ModelSelector label="文字起こし用モデル" options={TRANSCRIBE_MODELS} value={transcribeModel} onChange={setTranscribeModel}/>
              <ModelSelector label="法的分析用モデル" options={ANALYZE_MODELS} value={analyzeModel} onChange={setAnalyzeModel}/>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <button onClick={saveModels} style={{padding:'8px 24px',borderRadius:8,fontSize:13,fontWeight:600,
                  background:'linear-gradient(145deg,var(--gold2),#a8832e)',color:'var(--navy)',border:'none',cursor:'pointer'}}>設定を保存</button>
                {modelSaved&&<span style={{color:'var(--success)',fontSize:13,fontWeight:500}}>保存しました</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── ユーザー ── */}
        {tab==='users'&&(
          <div>
            <h2 style={{...goldTitle,fontSize:18,fontWeight:600,marginBottom:20}}>ユーザー管理</h2>
            <div style={{display:'flex',gap:8,marginBottom:16,maxWidth:400}}>
              <input value={newUserName} onChange={e=>setNewUserName(e.target.value)} placeholder="新しいユーザー名"
                onKeyDown={e=>e.key==='Enter'&&addUser()}
                style={{flex:1,padding:'8px 14px',borderRadius:8,fontSize:13,outline:'none',
                  background:'var(--surface)',border:'1px solid var(--gold-border)',color:'var(--text-primary)',fontFamily:"'Noto Sans JP',sans-serif"}}/>
              <button onClick={addUser} style={{padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,
                background:'linear-gradient(145deg,var(--gold2),#a8832e)',color:'var(--navy)',border:'none',cursor:'pointer'}}>追加</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {users.map(u=>(
                <div key={u.id} className="card-legal" style={{padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <span style={{color:'var(--text-primary)',fontSize:13,fontWeight:500}}>{u.name}</span>
                    <span style={{marginLeft:8,fontSize:10,color:'var(--text-muted)',padding:'1px 6px',borderRadius:3,border:'1px solid var(--gold-border)'}}>{u.role}</span>
                    <span style={{marginLeft:8,fontSize:10,color:'var(--text-muted)'}}>{fmtDate(u.created_at)}</span>
                  </div>
                  <button onClick={()=>deleteUser(u.id)} style={{fontSize:11,padding:'4px 10px',borderRadius:6,
                    background:'rgba(248,81,73,0.1)',color:'var(--danger)',border:'none',cursor:'pointer'}}>削除</button>
                </div>
              ))}
              {users.length===0&&<p style={{color:'var(--text-muted)',fontSize:13}}>ユーザーがいません</p>}
            </div>
          </div>
        )}

        {/* ── 履歴 ── */}
        {tab==='history'&&!selectedHearing&&(
          <div>
            <h2 style={{...goldTitle,fontSize:18,fontWeight:600,marginBottom:20}}>ヒアリング履歴</h2>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {hearings.map(h=>(
                <div key={h.id} className="card-legal" style={{padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setSelectedHearing(h as any)}>
                    <p style={{color:'var(--text-primary)',fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.case_name||'無題'}</p>
                    <div style={{display:'flex',gap:8,marginTop:2}}>
                      <span style={{fontSize:10,color:'var(--text-muted)'}}>{fmtDate(h.created_at)}</span>
                      {h.risk_level&&<span style={{fontSize:10,padding:'0 6px',borderRadius:3,fontWeight:500,
                        background:h.risk_level==='高'?'#fff0f0':h.risk_level==='中'?'#fffbf0':'#f0f7f2',
                        color:h.risk_level==='高'?'#8b1a1a':h.risk_level==='中'?'#7a5c1a':'#1e5c35',
                        border:`1px solid ${h.risk_level==='高'?'#f5c0c0':h.risk_level==='中'?'#f0dea0':'#b8dfc8'}`}}>{h.risk_level}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>setSelectedHearing(h as any)} style={{fontSize:11,padding:'4px 10px',borderRadius:6,
                      background:'var(--gold-dim)',color:'var(--gold)',border:'none',cursor:'pointer'}}>詳細</button>
                    <button onClick={()=>deleteHearing(h.id)} style={{fontSize:11,padding:'4px 10px',borderRadius:6,
                      background:'rgba(248,81,73,0.1)',color:'var(--danger)',border:'none',cursor:'pointer'}}>削除</button>
                  </div>
                </div>
              ))}
              {hearings.length===0&&<p style={{color:'var(--text-muted)',fontSize:13,padding:20,textAlign:'center'}}>まだ記録がありません</p>}
            </div>
          </div>
        )}

        {/* ── 履歴詳細 ── */}
        {tab==='history'&&selectedHearing&&(
          <div style={{maxWidth:700}}>
            <button onClick={()=>setSelectedHearing(null)} style={{fontSize:13,color:'var(--gold)',background:'none',border:'none',cursor:'pointer',marginBottom:12}}>← 一覧に戻る</button>
            <div className="card-legal" style={{padding:16,marginBottom:12}}>
              <h2 style={{...goldTitle,fontSize:16,fontWeight:600}}>{(selectedHearing.case_name as string)||'無題'}</h2>
              <p style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{fmtDate(selectedHearing.created_at as string)}</p>
            </div>
            {selectedHearing.summary&&<DetailSection title="相談要約" content={selectedHearing.summary as string}/>}
            {selectedHearing.legal_points&&<DetailSection title="法的論点" content={selectedHearing.legal_points as string}/>}
            {selectedHearing.risk_level&&<DetailSection title="リスクレベル" content={selectedHearing.risk_level as string}/>}
            {selectedHearing.strategy&&<DetailSection title="交渉戦略" content={selectedHearing.strategy as string}/>}
            {selectedHearing.next_date&&<DetailSection title="次回期日" content={selectedHearing.next_date as string}/>}
            {selectedHearing.transcript&&<DetailSection title="文字起こし" content={selectedHearing.transcript as string}/>}
          </div>
        )}
      </main>
    </div>
  );
}

function ModelSelector({label,options,value,onChange}:{label:string;options:{id:string;label:string;desc:string}[];value:string;onChange:(v:string)=>void}) {
  return (
    <div>
      <label style={{color:'var(--gold)',fontSize:13,fontWeight:600,marginBottom:10,display:'block'}}>{label}</label>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {options.map(m=>(
          <button key={m.id} onClick={()=>onChange(m.id)}
            style={{display:'flex',alignItems:'center',gap:10,padding:12,borderRadius:10,textAlign:'left',
              background:value===m.id?'var(--gold-dim)':'var(--surface)',border:`1px solid ${value===m.id?'var(--gold)':'var(--gold-border)'}`,
              cursor:'pointer',fontFamily:"'Noto Sans JP',sans-serif"}}>
            <div style={{width:16,height:16,borderRadius:8,border:`2px solid ${value===m.id?'var(--gold)':'var(--text-muted)'}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {value===m.id&&<div style={{width:8,height:8,borderRadius:4,background:'var(--gold)'}}/>}
            </div>
            <div>
              <p style={{color:'var(--text-primary)',fontSize:13,fontWeight:500}}>{m.label}</p>
              <p style={{color:'var(--text-muted)',fontSize:11}}>{m.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailSection({title,content}:{title:string;content:string}) {
  return (
    <div className="card-legal" style={{padding:14,marginBottom:8}}>
      <h3 style={{color:'var(--gold)',fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6,fontFamily:"'Noto Serif JP',serif"}}>{title}</h3>
      <p style={{color:'var(--text-primary)',fontSize:13,lineHeight:1.8,whiteSpace:'pre-wrap'}}>{content}</p>
    </div>
  );
}
