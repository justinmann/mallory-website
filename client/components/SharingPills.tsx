import React, { useState } from 'react';

export interface Sharing {
  visibility: 'private' | 'specific' | 'public';
  sharedWith: string[];
}

// Private / Specific / Public toggle. "Specific" reveals a small input to add
// the user ids allowed to read this book.
export function SharingPills({
  value,
  onChange,
}: {
  value: Sharing;
  onChange: (s: Sharing) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState('');

  const pill = (v: Sharing['visibility'], label: string): React.ReactElement => (
    <button
      key={v}
      onClick={() => onChange({ ...value, visibility: v })}
      style={{
        borderRadius: 20,
        padding: '4px 10px',
        cursor: 'pointer',
        border: '1px solid #4a3826',
        background: value.visibility === v ? '#5e2b2b' : '#1c130c',
        color: value.visibility === v ? '#fff' : '#d8c8a0',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {pill('private', 'Private')}
      {pill('specific', 'Specific')}
      {pill('public', 'Public')}
      {value.visibility === 'specific' && (
        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="user id"
            style={{ fontFamily: 'monospace', fontSize: 12, width: 90 }}
          />
          <button
            onClick={() => {
              const id = draft.trim();
              if (id && !value.sharedWith.includes(id)) {
                onChange({ ...value, sharedWith: [...value.sharedWith, id] });
              }
              setDraft('');
            }}
          >
            add
          </button>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#9a8a64' }}>
            {value.sharedWith.join(', ')}
          </span>
        </span>
      )}
    </div>
  );
}
