import React, { useEffect, useRef, useState } from 'react';
import { useApp } from 'ugly-app/client';
import { useRouter } from '../router';
import { createGame, type GameController } from '../game/createGame';
import type { GameBook, Vec2 } from '../game/types';
import { TouchJoystick } from './TouchJoystick';

// Just the fields the library needs from each book (the API also returns
// ownerId/pages/sharing, which we ignore here).
interface LibBook {
  _id: string;
  title: string;
  coverStyle: 'oxblood' | 'forest' | 'plain';
  lecternPos: { x: number; y: number };
}

function toGameBook(b: LibBook): GameBook {
  return { id: b._id, title: b.title, coverStyle: b.coverStyle, pos: b.lecternPos };
}

export default function LibraryGame(): React.ReactElement {
  const { socket } = useApp();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const joystickRef = useRef<Vec2>({ x: 0, y: 0 });
  const [books, setBooks] = useState<LibBook[]>([]);

  // Load the user's books once.
  useEffect(() => {
    void socket
      .request('listMyBooks', {})
      .then((r) => setBooks((r as { books: LibBook[] }).books));
  }, [socket]);

  // Boot the game once, on mount; tear it down on unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    controllerRef.current = createGame({
      canvas,
      books: books.map(toGameBook),
      getJoystick: () => joystickRef.current,
      events: {
        onOpenBook: (id) => router.push('book/:bookId', { bookId: id }),
        onLecternMoved: (id, pos) => {
          void socket.request('updateBook', { bookId: id, patch: { lecternPos: pos } });
        },
      },
    });
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
    // Boot once; book updates are pushed in via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push book-list changes into the running game.
  useEffect(() => {
    controllerRef.current?.setBooks(books.map(toGameBook));
  }, [books]);

  async function handleNewBook(): Promise<void> {
    await socket.request('createBook', {});
    const r = (await socket.request('listMyBooks', {})) as { books: LibBook[] };
    setBooks(r.books);
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0706' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <button
        onClick={() => void handleNewBook()}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
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
      <TouchJoystick
        onVector={(v) => {
          joystickRef.current = v;
        }}
        onAction={() => controllerRef.current?.pressAction()}
      />
    </div>
  );
}
