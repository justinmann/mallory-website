import React, { useEffect, useRef, useState } from 'react';
import { useApp } from 'ugly-app/client';
import { useRouter } from '../router';
import { buildId } from '../../shared/Build';

// Just the fields the library needs from each book (the API also returns
// ownerId/pages/sharing, which we ignore here).
interface LibBook {
  _id: string;
  title: string;
  coverStyle: 'oxblood' | 'forest' | 'plain';
  lecternPos: { x: number; y: number };
}

interface WireBook {
  id: string;
  title: string;
  coverStyle: 'oxblood' | 'forest' | 'plain';
  pos: { x: number; y: number };
}

function toWireBook(b: LibBook): WireBook {
  return { id: b._id, title: b.title, coverStyle: b.coverStyle, pos: b.lecternPos };
}

// The Godot game (HTML5 export) lives in client/public/game/. In dev Vite serves
// it at /game/...; in production the framework only serves built assets under
// /{buildId}/..., so the iframe src must be buildId-prefixed there.
const GAME_SRC = import.meta.env.PROD ? `/${buildId}/game/index.html` : '/game/index.html';

// Starter content for a brand-new visitor's first book.
const WELCOME_MD =
  '# Welcome to Mallory’s Library\n\n' +
  'Walk around with **WASD** or the **arrow keys** (or the joystick on a phone).\n\n' +
  'Stroll up to a lectern and press **E** to open its book and write in it.\n\n' +
  'Tap **+ New Volume** (top-right) to add a book of your own. Drag a lectern to move it.';

export default function LibraryGame(): React.ReactElement {
  const { socket } = useApp();
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const booksRef = useRef<LibBook[]>([]);
  const seededRef = useRef(false);
  const [books, setBooks] = useState<LibBook[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Push the current book list into the Godot game (only once it's ready).
  function sendBooks(list: LibBook[]): void {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current) return;
    win.postMessage({ type: 'mallory:setBooks', books: list.map(toWireBook) }, '*');
  }

  // Load the user's books; seed a welcome book on first visit so the room isn't empty.
  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      let list = ((await socket.request('listMyBooks', {})) as { books: LibBook[] }).books;
      if (list.length === 0 && !seededRef.current) {
        seededRef.current = true;
        const { id } = (await socket.request('createBook', {
          title: 'Welcome to Mallory’s Library',
        })) as { id: string };
        await socket.request('updateBook', { bookId: id, patch: { pages: [WELCOME_MD] } });
        list = ((await socket.request('listMyBooks', {})) as { books: LibBook[] }).books;
      }
      if (!cancelled) {
        booksRef.current = list;
        setBooks(list);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [socket]);

  // Listen for messages coming FROM the Godot game.
  useEffect(() => {
    function onMessage(e: MessageEvent): void {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; id?: string; pos?: { x: number; y: number } };
      switch (data.type) {
        case 'mallory:ready':
          readyRef.current = true;
          sendBooks(booksRef.current); // drain the current list on handshake
          break;
        case 'mallory:openBook':
          if (data.id) router.push('book/:bookId', { bookId: data.id });
          break;
        case 'mallory:lecternMoved':
          if (data.id && data.pos) {
            void socket.request('updateBook', { bookId: data.id, patch: { lecternPos: data.pos } });
          }
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // socket/router are stable; sendBooks reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever the book list changes, push it into the game (no-ops until ready).
  useEffect(() => {
    booksRef.current = books;
    sendBooks(books);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books]);

  async function handleNewBook(): Promise<void> {
    await socket.request('createBook', {});
    const r = (await socket.request('listMyBooks', {})) as { books: LibBook[] };
    setBooks(r.books);
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0706' }}>
      <iframe
        ref={iframeRef}
        src={GAME_SRC}
        title="Mallory's Library"
        allow="autoplay; fullscreen; gamepad"
        // allow-same-origin so the game can fetch its own .wasm/.pck; allow-scripts to run WASM.
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        onLoad={() => {
          setLoaded(true);
          iframeRef.current?.focus(); // the iframe must hold focus for WASD/E
        }}
      />

      {!loaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9a8a64',
            fontFamily: 'serif',
            fontSize: 18,
            background: 'radial-gradient(120% 90% at 50% 40%,#1a120c,#070504)',
            pointerEvents: 'none',
          }}
        >
          Lighting the candles…
        </div>
      )}

      <button
        onClick={() => void handleNewBook()}
        style={{
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          zIndex: 5,
          fontFamily: 'monospace',
          background: '#1c130c',
          color: '#e8b84b',
          border: '1px solid #c9a24b',
          borderRadius: 8,
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        + New Volume
      </button>
    </div>
  );
}
