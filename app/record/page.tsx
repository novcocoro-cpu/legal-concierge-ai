'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ResultCard from '@/components/result/ResultCard';
import ActionPlanList from '@/components/result/ActionPlanList';
import TranscriptAccordion from '@/components/result/TranscriptAccordion';
import NextMeetingCard from '@/components/result/NextMeetingCard';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useUserId } from '@/hooks/useUserId';
import { useMicPermission } from '@/hooks/useMicPermission';
import { GeminiResult } from '@/types';
import { logError } from '@/lib/logError';
import MicPermissionGuide from '@/components/record/MicPermissionGuide';
import { saveRecordingBackup, loadRecordingBackup, clearRecordingBackup } from '@/lib/recordingBackup';
import { uploadAndTranscribe } from '@/lib/audioUploader';
import GoogleDriveButton from '@/components/record/GoogleDriveButton';
import { saveToHistory } from '@/lib/localHistory';
import { downloadDocx, buildPlainText } from '@/lib/exportDocument';

type Phase = 'idle' | 'recording' | 'analyzing' | 'result';

const STEPS = ['音声変換中…', '文字起こし中…', '解析中…', '解析完了！'];
const DURATION_OPTIONS = [30, 60, 90, 120] as const;
const DEFAULT_LIMIT_MIN = 60;
const CHUNK_SAVE_INTERVAL_MS = 5 * 60 * 1000;

function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtTimer(sec: number) { return `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`; }

// ── SVG Icons (exact from HTML) ──
const MicSvgHeader = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const MicSvgBtn = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="#0a1628">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#0a1628" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" stroke="#0a1628" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="9" y1="22" x2="15" y2="22" stroke="#0a1628" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const StopIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
);

// ── Bottom Nav ──
function BottomNav() {
  const pathname = usePathname();
  const items = [
    { href: '/record',  label: '録音',  active: pathname === '/record',
      icon: <><circle cx="12" cy="12" r="6" fill="var(--gold)" stroke="none"/><circle cx="12" cy="12" r="10" fill="none" stroke="var(--gold)"/></> },
    { href: '/history', label: '履歴',  active: pathname.startsWith('/history'),
      icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></> },
    { href: '/todos',   label: '宿題',  active: pathname === '/todos',
      icon: <polyline points="20 6 9 17 4 12"/> },
    { href: '/admin',   label: '管理',  active: pathname === '/admin',
      icon: <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></> },
  ];
  return (
    <nav className="lc-nav safe-bottom">
      {items.map(it => (
        <Link key={it.href} href={it.href} className={`lc-nav-item ${it.active ? 'active' : ''}`}>
          <svg className="lc-nav-icon" viewBox="0 0 24 24">{it.icon}</svg>
          <span className="lc-nav-label">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// ── Toasts ──
function SuccessToast({ message }: { message: string }) {
  return (
    <div className="toast" style={{ position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',zIndex:50,
      padding:'8px 16px',borderRadius:12,fontSize:13,fontWeight:500,
      background:'var(--success)',color:'#fff',maxWidth:'90vw',boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
      {message}
    </div>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="toast" style={{ position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',zIndex:50,
      width:'calc(100% - 32px)',maxWidth:390 }}>
      <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',borderRadius:12,
        background:'var(--danger)',color:'#fff' }}>
        <span style={{ fontSize:14,flexShrink:0,marginTop:1 }}>⚠</span>
        <p style={{ fontSize:13,flex:1,lineHeight:1.5,whiteSpace:'pre-line' }}>{message}</p>
        <button onClick={onClose} style={{ flexShrink:0,opacity:0.8,background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:16 }}>✕</button>
      </div>
    </div>
  );
}

// ── Backup banner ──
function BackupBanner({ savedAt, durationSec, onRestore, onDiscard }:
  { savedAt: Date; durationSec: number; onRestore: () => void; onDiscard: () => void }) {
  const timeStr = savedAt.toLocaleString('ja-JP', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  const min = Math.floor(durationSec / 60);
  return (
    <div style={{ margin:'12px 20px 0', padding:14, borderRadius:10, background:'var(--navy2)', border:'2px solid var(--warning)',
      display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
        <span style={{ color:'var(--warning)', fontSize:16 }}>⚠</span>
        <div>
          <p style={{ color:'var(--text-primary)', fontSize:13, fontWeight:500 }}>保存済みの録音があります</p>
          <p style={{ color:'var(--text-muted)', fontSize:11, marginTop:2 }}>{timeStr} 保存（約{min}分）</p>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onRestore} style={{ flex:1, padding:'8px 0', borderRadius:10, fontSize:13, fontWeight:600,
          background:'var(--gold)', color:'var(--navy)', border:'none', cursor:'pointer' }}>文字起こしする</button>
        <button onClick={onDiscard} style={{ padding:'8px 16px', borderRadius:10, fontSize:13,
          background:'transparent', color:'var(--text-muted)', border:'1px solid var(--gold-border)', cursor:'pointer' }}>削除</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// メインページ
// ══════════════════════════════════════════
export default function RecordPage() {
  const { userId, userName, companyName, setUserName, setCompanyName } = useUserId();
  const { isRecording, seconds, startRecording, stopRecording, getSnapshot, error: recError } = useAudioRecorder();
  const { status: micStatus, requestPermission } = useMicPermission();

  const [phase, setPhase]             = useState<Phase>('idle');
  const [stepIndex, setStepIndex]     = useState(0);
  const [result, setResult]           = useState<GeminiResult | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [audioBlob, setAudioBlob]     = useState<Blob | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [nameInput, setNameInput]     = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [caseNameInput, setCaseNameInput] = useState('');
  const [limitMin, setLimitMin]       = useState<number>(DEFAULT_LIMIT_MIN);
  const [backup, setBackup]           = useState<{ savedAt: Date; durationSec: number; blob: Blob } | null>(null);
  const [copied, setCopied]           = useState(false);
  const savingRef   = useRef(false);
  const autoStopRef = useRef(false);

  // ── Effects ──
  useEffect(() => {
    fetch('/api/settings?key=default_recording_minutes')
      .then(r => r.json()).then(d => { const v = parseInt(d.value,10); if(!isNaN(v)&&v>0) setLimitMin(v); }).catch(()=>{});
  }, []);

  useEffect(() => {
    loadRecordingBackup().then(b => {
      if(!b) return;
      if(Date.now()-b.savedAt.getTime()<24*60*60*1000) setBackup({savedAt:b.savedAt,durationSec:b.durationSec,blob:b.blob});
      else clearRecordingBackup();
    });
  }, []);

  useEffect(() => {
    if(phase!=='recording') return;
    const interval = setInterval(async()=>{
      const snap=getSnapshot(); if(snap) await saveRecordingBackup(snap.chunks,snap.mimeType,seconds);
    }, CHUNK_SAVE_INTERVAL_MS);
    return ()=>clearInterval(interval);
  }, [phase,getSnapshot,seconds]);

  useEffect(() => {
    if(phase!=='recording'){autoStopRef.current=false;return;}
    if(seconds>=limitMin*60&&!autoStopRef.current){autoStopRef.current=true;handleStopAndAnalyze();}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds,phase,limitMin]);

  const showSuccess = (m:string) => { setSuccessMsg(m); setTimeout(()=>setSuccessMsg(null),2500); };
  const showError   = (m:string) => setErrorMsg(m);

  const autoSave = async (data:GeminiResult, dur:number) => {
    if(savingRef.current) return; savingRef.current=true;
    try {
      saveToHistory({ title:data.title, caseName:caseNameInput||data.title, result:data, durationSec:dur,
        userName:userName||'名無し', companyName:companyName||'' });
      showSuccess('相談記録を保存しました');
      await clearRecordingBackup(); setBackup(null);
    } catch(e){ const msg=e instanceof Error?e.message:'保存に失敗しました'; showError(`保存エラー: ${msg}`); logError(msg,'保存');
    } finally { savingRef.current=false; }
  };

  const analyzeBlob = useCallback(async (blob:Blob, dur:number) => {
    setAudioBlob(blob); setPhase('analyzing'); setStepIndex(0);
    const stepTimer = setInterval(()=>setStepIndex(i=>Math.min(i+1,STEPS.length-1)),1200);
    try {
      const data:GeminiResult = await uploadAndTranscribe(blob, (step)=>{
        if(step.includes('文字起こし'))setStepIndex(1); else if(step.includes('解析'))setStepIndex(2);
      });
      clearInterval(stepTimer); setStepIndex(STEPS.length-1); setResult(data); setPhase('result'); autoSave(data,dur);
    } catch(e){
      clearInterval(stepTimer); const msg=e instanceof Error?e.message:'解析に失敗しました';
      showError(`文字起こしエラー: ${msg}`); logError(msg,'文字起こし'); setPhase('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId,userName,caseNameInput]);

  const handleStopAndAnalyze = useCallback(async () => {
    const dur=seconds; const blob=await stopRecording(); setDurationSec(dur);
    const snap=getSnapshot(); if(snap) await saveRecordingBackup(snap.chunks,snap.mimeType,dur);
    await analyzeBlob(blob,dur);
  }, [seconds,stopRecording,getSnapshot,analyzeBlob]);

  const handleToggleRecording = useCallback(async () => {
    if(isRecording){ await handleStopAndAnalyze(); }
    else {
      try { await startRecording(); setPhase('recording'); setResult(null); autoStopRef.current=false; }
      catch(e){
        const err=e instanceof DOMException?e:null;
        const isPerm=err?.name==='NotAllowedError'||err?.name==='PermissionDeniedError'||err?.name==='SecurityError';
        const msg=e instanceof Error?e.message:(recError||'マイクにアクセスできません');
        if(!isPerm) showError(`マイクアクセスエラー: ${msg}`); logError(msg,'マイクアクセス');
      }
    }
  }, [isRecording,handleStopAndAnalyze,startRecording,recError]);

  const handleRestoreBackup = useCallback(async()=>{ if(!backup)return; setBackup(null); await analyzeBlob(backup.blob,backup.durationSec); },[backup,analyzeBlob]);
  const handleDiscardBackup = useCallback(async()=>{ setBackup(null); await clearRecordingBackup(); },[]);

  const handleCopy = async () => {
    if(!result) return;
    try { await navigator.clipboard.writeText(buildPlainText(result)); setCopied(true); setTimeout(()=>setCopied(false),2000); }
    catch { showError('コピーに失敗しました'); }
  };

  const handleDownloadAudio = () => {
    if(!audioBlob) return;
    const date=new Date().toISOString().slice(0,10).replace(/-/g,'');
    const cn=(caseNameInput||result?.title||'案件').replace(/[\\/:*?"<>|]/g,'_').slice(0,30);
    const url=URL.createObjectURL(audioBlob); const a=document.createElement('a');
    a.href=url; a.download=`${date}_${cn}.mp3`; a.click(); URL.revokeObjectURL(url);
  };

  // ── Mic permission ──
  if(userName!==null&&userId){
    if(micStatus==='checking') return (
      <div className="page-shell" style={{justifyContent:'center',alignItems:'center'}}><div className="lc-spinner"/></div>
    );
    if(micStatus==='prompt'||micStatus==='denied'||micStatus==='unavailable')
      return <MicPermissionGuide status={micStatus} onRequest={requestPermission}/>;
  }

  // ── Onboarding ──
  if(userName===null&&userId){
    const handleStart=()=>{ if(!companyInput.trim()||!nameInput.trim())return; setCompanyName(companyInput.trim()); setUserName(nameInput.trim()); };
    return (
      <div className="page-shell" style={{justifyContent:'center',alignItems:'center',padding:24}}>
        <div style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
          <div className="lc-header-icon" style={{width:64,height:64,borderRadius:16}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <div style={{textAlign:'center'}}>
            <h1 style={{fontFamily:"'Noto Serif JP',serif",fontSize:22,color:'var(--gold2)',fontWeight:600,marginBottom:8}}>法務コンシェルジュ</h1>
            <p style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.8}}>
              録音するだけで、相談要約・法的論点<br/>対応方針・訴訟リスク評価を<br/>AI が自動生成します。
            </p>
          </div>
          <div style={{width:'100%'}}>
            <div className="case-label">法律事務所名 <span style={{color:'var(--danger)'}}>*</span></div>
            <input className="case-input" type="text" placeholder="例：○○法律事務所" value={companyInput} onChange={e=>setCompanyInput(e.target.value)} autoFocus/>
          </div>
          <div style={{width:'100%'}}>
            <div className="case-label">弁護士名 <span style={{color:'var(--danger)'}}>*</span></div>
            <input className="case-input" type="text" placeholder="例：田中 太郎" value={nameInput} onChange={e=>setNameInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleStart()}/>
          </div>
          <button onClick={handleStart} disabled={!companyInput.trim()||!nameInput.trim()}
            style={{width:'100%',padding:'12px 0',borderRadius:10,fontSize:13,fontWeight:600,fontFamily:"'Noto Sans JP',sans-serif",
              background:'linear-gradient(145deg,var(--gold2),#a8832e)',color:'var(--navy)',border:'none',cursor:'pointer',
              opacity:(!companyInput.trim()||!nameInput.trim())?0.4:1,transition:'opacity 0.2s',letterSpacing:'0.05em'}}>
            はじめる →
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  // Main render
  // ══════════════════════════════════════
  const isRec = phase === 'recording';
  const totalSec = limitMin * 60;
  const remaining = Math.max(0, totalSec - seconds);
  const progress = Math.min(1, seconds / totalSec);

  return (
    <div className="page-shell">
      {successMsg && <SuccessToast message={successMsg}/>}
      {errorMsg   && <ErrorBanner message={errorMsg} onClose={()=>setErrorMsg(null)}/>}

      {/* ── Header ── */}
      <div className="lc-header">
        <div className="lc-header-icon"><MicSvgHeader/></div>
        <div className="lc-header-title">ヒアリング録音</div>
      </div>

      {/* ── Body ── */}
      <div className="lc-body">

        {/* Backup banner */}
        {phase==='idle'&&backup&&(
          <BackupBanner savedAt={backup.savedAt} durationSec={backup.durationSec} onRestore={handleRestoreBackup} onDiscard={handleDiscardBackup}/>
        )}

        {/* ──── IDLE ──── */}
        {phase==='idle'&&(
          <>
            <div>
              <div className="case-label">案件名</div>
              <input className="case-input" type="text" placeholder="例：田中様　離婚調停案件"
                value={caseNameInput} onChange={e=>setCaseNameInput(e.target.value)}/>
            </div>
            <div>
              <div className="timer-display">{fmtTimer(seconds)}</div>
              <div className="timer-sub">RECORDING TIME</div>
            </div>
            <div className="dur-wrap">
              {DURATION_OPTIONS.map(min=>(
                <button key={min} className={`dur-pill ${limitMin===min?'active':''}`}
                  onClick={()=>setLimitMin(min)}>{min}分</button>
              ))}
            </div>
            <div className="mic-area">
              <div className="mic-ring">
                <button className="mic-btn" onClick={handleToggleRecording}><MicSvgBtn/></button>
              </div>
              <div className="mic-hint">タップして録音を開始</div>
            </div>
            <div className="lc-divider"><span className="lc-divider-text">または</span></div>
            <GoogleDriveButton disabled={false}
              onFileSelected={(blob,fileName)=>{
                const ext=fileName.split('.').pop()?.toLowerCase()||'webm';
                const mimeMap:Record<string,string>={mp3:'audio/mpeg',mp4:'video/mp4',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm',flac:'audio/flac',aac:'audio/aac'};
                const mime=mimeMap[ext]||blob.type||'audio/webm';
                analyzeBlob(new Blob([blob],{type:mime}),0);
              }}
              onError={msg=>showError(msg)} onProgress={()=>{}}/>
          </>
        )}

        {/* ──── RECORDING ──── */}
        {phase==='recording'&&(
          <>
            <div>
              <div className="case-label">案件名</div>
              <input className="case-input" type="text" placeholder="例：田中様　離婚調停案件"
                value={caseNameInput} onChange={e=>setCaseNameInput(e.target.value)} disabled/>
            </div>
            <div>
              <div className="timer-display recording">{fmtTimer(remaining)}</div>
              <div className="timer-sub" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                <span>{fmtTimer(seconds)} / {fmtTimer(totalSec)}</span>
                <div className="progress-bar-wrap">
                  <div className={`progress-bar-fill ${remaining<=60?'danger':''}`} style={{width:`${(progress*100).toFixed(1)}%`}}/>
                </div>
              </div>
            </div>
            {/* Waveform */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:3,height:40}}>
              {Array.from({length:11}).map((_,i)=>(
                <div key={i} className="wave-bar" style={{animation:`wave ${0.6+(i%5)*0.12}s ease-in-out ${(i*0.07).toFixed(2)}s infinite`}}/>
              ))}
            </div>
            <div className="mic-area">
              <div className="mic-ring" style={{borderColor:'rgba(220,80,80,0.3)',background:'rgba(220,80,80,0.08)'}}>
                <button className="mic-btn recording" onClick={handleToggleRecording}><StopIcon/></button>
              </div>
              <div className="mic-hint recording">録音中 — タップして停止</div>
            </div>
            {remaining<=60 && (
              <p style={{textAlign:'center',fontSize:11,color:'var(--warning)',fontWeight:500,animation:'blink 1.2s ease-in-out infinite'}}>
                まもなく自動停止します
              </p>
            )}
          </>
        )}

        {/* ──── ANALYZING ──── */}
        {phase==='analyzing'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
            <div className="lc-spinner"/>
            <div style={{textAlign:'center'}}>
              <p style={{color:'var(--text-primary)',fontWeight:500,fontSize:14}}>{STEPS[stepIndex]}</p>
              <p style={{color:'var(--text-muted)',fontSize:11,marginTop:4}}>AI が法律相談を解析中です</p>
            </div>
            <div style={{display:'flex',gap:6}}>
              {STEPS.map((_,i)=>(
                <div key={i} style={{width:8,height:8,borderRadius:4,transition:'background 0.3s',
                  background:i<=stepIndex?'var(--gold)':'var(--gold-border)'}}/>
              ))}
            </div>
          </div>
        )}

        {/* ──── RESULT ──── */}
        {phase==='result'&&result&&(
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {/* Title card */}
            <div className="card-legal" style={{padding:16}}>
              <h2 style={{fontFamily:"'Noto Serif JP',serif",fontSize:17,color:'var(--gold2)',fontWeight:600,marginBottom:4}}>{result.title}</h2>
              <p style={{fontSize:11,color:'var(--text-muted)',fontFamily:'JetBrains Mono,monospace'}}>
                {new Date().toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'})}
                {caseNameInput&&<span style={{marginLeft:8,color:'var(--gold)'}}>| {caseNameInput}</span>}
              </p>
            </div>

            <TranscriptAccordion transcript={result.transcript}/>

            <ResultCard title="相談内容の要約" icon="📄">
              <p style={{color:'var(--text-primary)',fontSize:13,lineHeight:1.7}}>{result.summary}</p>
            </ResultCard>

            <ResultCard title="法的論点・争点" icon="⚠️">
              <ul style={{display:'flex',flexDirection:'column',gap:6}}>
                {result.problems?.map((p,i)=>(
                  <li key={i} style={{color:'var(--text-primary)',fontSize:13,display:'flex',alignItems:'flex-start',gap:8}}>
                    <span style={{color:'var(--danger)'}}>•</span>{p}
                  </li>
                ))}
              </ul>
            </ResultCard>

            <ResultCard title="対応方針" icon="💡">
              <ul style={{display:'flex',flexDirection:'column',gap:6}}>
                {result.improvements?.map((imp,i)=>(
                  <li key={i} style={{color:'var(--text-primary)',fontSize:13,display:'flex',alignItems:'flex-start',gap:8}}>
                    <span style={{color:'var(--success)'}}>•</span>{imp}
                  </li>
                ))}
              </ul>
            </ResultCard>

            {result.litigation_risk&&(
              <ResultCard title="訴訟リスク評価" icon="🔥">
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:20,color:'#fff',
                      background:result.litigation_risk.level==='高'?'var(--danger)':result.litigation_risk.level==='中'?'var(--warning)':'var(--success)'}}>
                      {result.litigation_risk.level}
                    </span>
                    <span style={{color:'var(--text-primary)',fontSize:13}}>{result.litigation_risk.description}</span>
                  </div>
                  <ul style={{display:'flex',flexDirection:'column',gap:4}}>
                    {result.litigation_risk.factors?.map((f,i)=>(
                      <li key={i} style={{color:'var(--text-primary)',fontSize:13,display:'flex',alignItems:'flex-start',gap:8}}>
                        <span style={{color:'var(--warning)'}}>•</span>{f}
                      </li>
                    ))}
                  </ul>
                </div>
              </ResultCard>
            )}

            {result.negotiation_strategy&&(
              <ResultCard title="交渉戦略・心理的分析" icon="🧠">
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div><p style={{fontSize:10,color:'var(--text-muted)',marginBottom:2}}>戦略</p><p style={{color:'var(--text-primary)',fontSize:13}}>{result.negotiation_strategy.approach}</p></div>
                  <div><p style={{fontSize:10,color:'var(--text-muted)',marginBottom:2}}>心理的分析</p><p style={{color:'var(--text-primary)',fontSize:13}}>{result.negotiation_strategy.psychological_notes}</p></div>
                  <ul style={{display:'flex',flexDirection:'column',gap:4}}>
                    {result.negotiation_strategy.key_points?.map((kp,i)=>(
                      <li key={i} style={{color:'var(--text-primary)',fontSize:13,display:'flex',alignItems:'flex-start',gap:8}}>
                        <span style={{color:'var(--gold)'}}>•</span>{kp}
                      </li>
                    ))}
                  </ul>
                </div>
              </ResultCard>
            )}

            <ResultCard title="宿題事項・期日" icon="🎯">
              <ActionPlanList items={result.action_plan}/>
            </ResultCard>
            <NextMeetingCard data={result.next_meeting}/>

            {/* ── 3 export buttons ── */}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>downloadDocx(result)} style={{flex:1,padding:'10px 0',borderRadius:10,fontSize:12,fontWeight:600,
                background:'var(--navy2)',color:'var(--gold2)',border:'1px solid var(--gold-border)',cursor:'pointer',letterSpacing:'0.05em',
                fontFamily:"'Noto Sans JP',sans-serif",transition:'all 0.2s'}}>
                📄 Word
              </button>
              <button onClick={handleCopy} style={{flex:1,padding:'10px 0',borderRadius:10,fontSize:12,fontWeight:600,
                background:copied?'var(--success)':'var(--navy2)',color:copied?'#fff':'var(--text-primary)',
                border:`1px solid ${copied?'var(--success)':'var(--gold-border)'}`,cursor:'pointer',letterSpacing:'0.05em',
                fontFamily:"'Noto Sans JP',sans-serif",transition:'all 0.2s'}}>
                {copied?'✓ コピー済み':'📋 コピー'}
              </button>
              <button onClick={handleDownloadAudio} disabled={!audioBlob}
                style={{flex:1,padding:'10px 0',borderRadius:10,fontSize:12,fontWeight:600,
                  background:'linear-gradient(145deg,var(--gold2),#a8832e)',color:'var(--navy)',border:'none',cursor:'pointer',
                  opacity:audioBlob?1:0.4,letterSpacing:'0.05em',fontFamily:"'Noto Sans JP',sans-serif",transition:'all 0.2s'}}>
                🎙 音声
              </button>
            </div>

            <button onClick={()=>{setPhase('idle');setResult(null);setAudioBlob(null);setCaseNameInput('');}}
              style={{width:'100%',padding:'10px 0',borderRadius:10,fontSize:12,
                background:'transparent',color:'var(--text-muted)',border:'1px solid var(--gold-border)',cursor:'pointer',
                fontFamily:"'Noto Sans JP',sans-serif",letterSpacing:'0.05em'}}>
              新しいヒアリングを開始
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <BottomNav/>
    </div>
  );
}
