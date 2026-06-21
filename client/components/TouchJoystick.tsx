import React, { useRef } from 'react';
import type { Vec2 } from '../game/types';

// An on-screen joystick (bottom-left) + an action button (bottom-right) for
// touch devices. It reports a movement vector (length 0..1) and an "open" tap.
// On desktop it's harmless — it only reacts to touch events.
export function TouchJoystick({
  onVector,
  onAction,
}: {
  onVector: (v: Vec2) => void;
  onAction: () => void;
}): React.ReactElement {
  const base = useRef<HTMLDivElement>(null);
  const RADIUS = 48;

  function handle(e: React.TouchEvent): void {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - (r.left + r.width / 2);
    const dy = t.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, RADIUS);
    onVector({ x: (dx / len) * (clamped / RADIUS), y: (dy / len) * (clamped / RADIUS) });
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', touchAction: 'none' }}>
      <div
        ref={base}
        onTouchStart={handle}
        onTouchMove={handle}
        onTouchEnd={() => onVector({ x: 0, y: 0 })}
        style={{
          position: 'absolute',
          left: 24,
          bottom: 24,
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: '2px solid #c9a24b',
          background: 'rgba(10,7,6,.55)',
          pointerEvents: 'auto',
        }}
      />
      <button
        onTouchStart={(e) => {
          e.preventDefault();
          onAction();
        }}
        style={{
          position: 'absolute',
          right: 24,
          bottom: 36,
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '2px solid #e8b84b',
          background: 'rgba(10,7,6,.7)',
          color: '#e8b84b',
          fontFamily: 'monospace',
          fontSize: 18,
          pointerEvents: 'auto',
        }}
      >
        E
      </button>
    </div>
  );
}
