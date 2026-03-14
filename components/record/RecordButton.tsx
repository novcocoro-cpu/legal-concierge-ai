'use client';

interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function RecordButton({ isRecording, onClick, disabled }: RecordButtonProps) {
  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      {isRecording && (
        <>
          <div
            className="pulse-ring-1 absolute inset-0 rounded-full"
            style={{ background: 'var(--danger)', opacity: 0.3 }}
          />
          <div
            className="pulse-ring-2 absolute inset-0 rounded-full"
            style={{ background: 'var(--danger)', opacity: 0.2 }}
          />
          <div
            className="pulse-ring-3 absolute inset-0 rounded-full"
            style={{ background: 'var(--danger)', opacity: 0.1 }}
          />
        </>
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
        style={{
          background: isRecording
            ? 'var(--danger)'
            : 'var(--gold-grad)',
          border: isRecording
            ? '3px solid var(--danger)'
            : '3px solid var(--accent-light)',
          boxShadow: isRecording
            ? '0 0 24px rgba(248,81,73,0.5)'
            : '0 0 24px rgba(201,168,76,0.35), 0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {isRecording ? (
          <span className="w-7 h-7 rounded bg-white" />
        ) : (
          <svg className="w-10 h-10" fill="#0a1628" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
