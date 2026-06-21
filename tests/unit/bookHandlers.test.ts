import { describe, it, expect } from 'vitest';
import { buildNewBook } from '../../server/bookHandlers';

describe('buildNewBook', () => {
  it('creates a private oxblood book with one empty page', () => {
    const b = buildNewBook('owner', {});
    expect(b.ownerId).toBe('owner');
    expect(b.sharing.visibility).toBe('private');
    expect(b.coverStyle).toBe('oxblood');
    expect(b.pages).toEqual(['']);
    expect(typeof b._id).toBe('string');
  });
  it('honors title and coverStyle options', () => {
    const b = buildNewBook('owner', { title: 'Spells', coverStyle: 'forest' });
    expect(b.title).toBe('Spells');
    expect(b.coverStyle).toBe('forest');
  });
});
