import { describe, it, expect } from 'vitest';
import { canReadBook, assertOwner } from '../../shared/bookAccess';

const base = { ownerId: 'owner' };
const priv = { ...base, sharing: { visibility: 'private' as const, sharedWith: [] } };
const pub = { ...base, sharing: { visibility: 'public' as const, sharedWith: [] } };
const spec = { ...base, sharing: { visibility: 'specific' as const, sharedWith: ['friend'] } };

describe('canReadBook', () => {
  it('owner always reads', () => expect(canReadBook(priv, 'owner')).toBe(true));
  it('stranger cannot read private', () => expect(canReadBook(priv, 'x')).toBe(false));
  it('anyone reads public, even logged-out', () => expect(canReadBook(pub, null)).toBe(true));
  it('specific allows listed user only', () => {
    expect(canReadBook(spec, 'friend')).toBe(true);
    expect(canReadBook(spec, 'x')).toBe(false);
  });
});

describe('assertOwner', () => {
  it('passes for owner', () => expect(() => assertOwner(base, 'owner')).not.toThrow());
  it('throws for non-owner', () => expect(() => assertOwner(base, 'x')).toThrow('Forbidden'));
});
