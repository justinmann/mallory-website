import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from 'ugly-app/client';
import { MarkdownEditor } from 'ugly-app/markdown/client';
import { useRouter } from '../router';
import { BookChrome } from '../components/BookChrome';
import { SharingPills, type Sharing } from '../components/SharingPills';

// Just the book fields the view needs (the wire shape; no created/updated).
interface BookView {
  _id: string;
  ownerId: string;
  title: string;
  coverStyle: 'oxblood' | 'forest' | 'plain';
  pages: string[];
  lecternPos: { x: number; y: number };
  sharing: Sharing;
}

type BookPatch = Partial<Pick<BookView, 'title' | 'coverStyle' | 'pages' | 'sharing'>>;

export default function BookPage({ bookId }: { bookId: string }): React.ReactElement {
  const { socket, userId } = useApp();
  const router = useRouter();
  const [book, setBook] = useState<BookView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 900));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onResize = (): void => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    void socket.request('getBook', { bookId }).then((r) => {
      setBook((r as { book: BookView | null }).book);
      setLoaded(true);
    });
  }, [socket, bookId]);

  const scheduleSave = useCallback(
    (patch: BookPatch) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void socket.request('updateBook', { bookId, patch });
      }, 600);
    },
    [socket, bookId],
  );

  if (!loaded) return <div style={{ color: '#d8c8a0', padding: 24 }}>Opening…</div>;
  if (!book) {
    return (
      <div style={{ color: '#d8c8a0', padding: 24, fontFamily: 'serif' }}>
        This volume is sealed (private, or it doesn’t exist).{' '}
        <button onClick={() => router.push('library', {})}>← Library</button>
      </div>
    );
  }

  const isOwner = book.ownerId === userId;
  const pages = book.pages.length ? book.pages : [''];
  const isNarrow = vw < 640;
  const step = isNarrow ? 1 : 2;

  const bookWidth = Math.min(900, vw - 32) - 36;
  const colWidth = Math.max(220, Math.floor((isNarrow ? bookWidth : bookWidth / 2) - 56));

  function setPage(idx: number, md: string): void {
    setBook((prev) => {
      if (!prev) return prev;
      const next = [...prev.pages];
      next[idx] = md;
      scheduleSave({ pages: next });
      return { ...prev, pages: next };
    });
  }

  function renderPage(idx: number): React.ReactNode {
    if (idx >= pages.length) {
      return <div style={{ color: '#9a8a64', fontFamily: 'monospace', fontSize: 12 }}>— end —</div>;
    }
    return (
      <MarkdownEditor
        value={pages[idx] ?? ''}
        disabled={!isOwner}
        placeholder={isOwner ? 'Write…  (type # for a big heading)' : ''}
        onValueChanged={(md) => setPage(idx, md)}
        menuAbove
        limitedToolbar
        width={colWidth}
        fileId={null}
      />
    );
  }

  const lastShown = Math.min(pageIndex + step, pages.length);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          right: 12,
          zIndex: 5,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'monospace',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => router.push('library', {})}
          style={btn('#e8b84b', '#c9a24b')}
        >
          ← Library
        </button>
        {isOwner && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <SharingPills
              value={book.sharing}
              onChange={(s) => {
                setBook({ ...book, sharing: s });
                scheduleSave({ sharing: s });
              }}
            />
            <button
              onClick={() => {
                const next = [...book.pages, ''];
                setBook({ ...book, pages: next });
                scheduleSave({ pages: next });
              }}
              style={btn('#e8b84b', '#c9a24b')}
            >
              + Page
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this volume?')) {
                  void socket.request('deleteBook', { bookId }).then(() => router.push('library', {}));
                }
              }}
              style={btn('#8a3a3a', '#5e2b2b')}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <BookChrome
        single={isNarrow}
        left={renderPage(pageIndex)}
        right={renderPage(pageIndex + 1)}
        pageLabel={`— ${pageIndex + 1}${isNarrow ? '' : `–${lastShown}`} of ${pages.length} —`}
        onPrev={() => setPageIndex((i) => Math.max(0, i - step))}
        onNext={() => setPageIndex((i) => (i + step < pages.length ? i + step : i))}
      />
    </>
  );
}

function btn(color: string, border: string): React.CSSProperties {
  return {
    background: '#1c130c',
    color,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontFamily: 'monospace',
  };
}
