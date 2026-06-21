import React from 'react';

// The open-book visual frame: brass-bound cover, aged-paper pages, page-turn
// arrows. Renders two pages side by side, or one page when `single` (mobile).
export function BookChrome({
  left,
  right,
  onPrev,
  onNext,
  pageLabel,
  single,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  pageLabel: string;
  single: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(120% 90% at 50% 20%,#1a120c,#070504)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(900px,100%)',
          aspectRatio: single ? '3 / 4' : '16 / 10',
          background: 'linear-gradient(#241811,#1c130c)',
          borderRadius: 16,
          padding: 18,
          boxShadow: '0 34px 80px rgba(0,0,0,.7), inset 0 0 0 6px #c9a24b',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: single ? '1fr' : '1fr 1fr',
            height: '100%',
            background: 'linear-gradient(#d8c8a0,#cbb98c)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '24px 28px', overflow: 'auto', boxShadow: single ? undefined : 'inset -16px 0 26px -16px rgba(40,25,12,.7)' }}>
            {left}
          </div>
          {!single && (
            <div style={{ padding: '24px 28px', overflow: 'auto', boxShadow: 'inset 16px 0 26px -16px rgba(40,25,12,.7)' }}>
              {right}
            </div>
          )}
        </div>
        <button onClick={onPrev} style={arrow('left')}>
          ‹
        </button>
        <button onClick={onNext} style={arrow('right')}>
          ›
        </button>
      </div>
      <div style={{ fontFamily: 'monospace', color: '#9a8a64', fontSize: 12 }}>{pageLabel}</div>
    </div>
  );
}

function arrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: -10,
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(10,7,6,.85)',
    color: '#e8b84b',
    border: '1px solid #e8b84b',
    fontSize: 20,
    cursor: 'pointer',
  };
}
