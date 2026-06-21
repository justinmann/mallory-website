import { describe, it, expect } from 'vitest';
import { BookSchema } from '../../shared/collections';

const valid = {
  ownerId: 'u1',
  title: 'The Travelogue',
  coverStyle: 'oxblood' as const,
  pages: ['# Day one'],
  lecternPos: { x: 100, y: 80 },
  sharing: { visibility: 'private' as const, sharedWith: [] },
};

describe('BookSchema', () => {
  it('accepts a valid book', () => {
    expect(BookSchema.parse(valid)).toMatchObject({ title: 'The Travelogue' });
  });
  it('rejects an unknown visibility', () => {
    expect(() =>
      BookSchema.parse({ ...valid, sharing: { visibility: 'world', sharedWith: [] } }),
    ).toThrow();
  });
  it('defaults pages to a single empty page', () => {
    const { pages } = BookSchema.parse({ ...valid, pages: undefined });
    expect(pages).toEqual(['']);
  });
});
