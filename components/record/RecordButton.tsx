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
          background: isRecording ? 'var(--danger)' : 'var(--surface2)',
          border: `3px solid ${isRecording ? 'var(--danger)' : 'var(--border)'}`,
          boxShadow: isRecording ? '0 0 24px rgba(248,81,73,0.4)' : 'none',
        }}
      >
        {isRecording ? (
          <span className="w-7 h-7 rounded bg-white" />
        ) : (
          <span className="text-4xl">🎙</span>
        )}
      </button>
    </div>
  );
}
