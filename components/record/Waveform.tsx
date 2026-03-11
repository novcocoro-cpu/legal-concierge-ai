'use client';

const BARS = 11;

export default function Waveform() {
  return (
    <div className="flex items-center gap-[3px] h-10">
      {Array.from({ length: BARS }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--accent)',
            width: '3px',
            height: '100%',
            borderRadius: '2px',
            animation: `wave ${0.6 + (i % 5) * 0.12}s ease-in-out ${(i * 0.07).toFixed(2)}s infinite`,
            transformOrigin: 'center',
          }}
        />
      ))}
    </div>
  );
}
