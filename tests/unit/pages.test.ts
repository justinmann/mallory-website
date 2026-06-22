import { describe, expect, it } from 'vitest';
import { pages } from '../../shared/pages';

describe('Page definitions', () => {
  it('home page is the library and requires auth', () => {
    // Home ('') IS Mallory's Library — your own library, so it's auth-gated.
    const home = pages[''];
    expect(home).toBeDefined();
    expect(home.auth).toBe(true);
  });

  it('auth-demo page exists and is public', () => {
    const authDemo = pages['auth-demo'];
    expect(authDemo).toBeDefined();
    expect(authDemo.auth).toBe(false);
  });

  it('authenticated pages require auth', () => {
    const authPages = ['test/todo', 'test/ai', 'test/upload'] as const;
    for (const key of authPages) {
      expect(pages[key].auth, `${key} should require auth`).toBe(true);
    }
  });
});
