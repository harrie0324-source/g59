import { createHash } from 'crypto';
import { ids, newId, setRandomSource, stableId, uuidv5, uuidv7 } from '../ids';

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function nodeV5(name: string, ns: string): string {
  const h = createHash('sha1').update(Buffer.from(ns.replace(/-/g, ''), 'hex')).update(name).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const s = h.subarray(0, 16).toString('hex');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

describe('ids', () => {
  it('uuidv5 matches the RFC example', () => {
    expect(uuidv5('www.example.com', DNS)).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });

  it('uuidv5 matches Node crypto for short, multi-block and unicode names', () => {
    for (const name of ['', 'day:2026-10-12', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(200), 'café ✓']) {
      expect(uuidv5(name, DNS)).toBe(nodeV5(name, DNS));
    }
  });

  it('stable IDs are deterministic and distinct per key', () => {
    expect(ids.day('2026-10-12')).toBe(ids.day('2026-10-12'));
    expect(ids.day('2026-10-12')).not.toBe(ids.day('2026-10-13'));
    expect(ids.checkIn('2026-10-12')).not.toBe(ids.day('2026-10-12'));
    expect(stableId('profile')).toBe(ids.profile());
    expect(ids.steps('healthkit', '2026-10-12')).toMatch(/^[0-9a-f-]{36}$/);
    expect(ids.healthSample('healthkit', 'ABC')).toBe(stableId('healthkit:ABC'));
  });

  it('uuidv7 is valid, unique and time-ordered', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(UUID_RE);
    expect(a[14]).toBe('7');
    expect(a < b).toBe(true);
    expect(a.slice(0, 13)).toBe('018bcfe5-6800');
    const many = new Set(Array.from({ length: 1000 }, newId));
    expect(many.size).toBe(1000);
  });

  it('uses the injected random source', () => {
    setRandomSource((n) => new Uint8Array(n).fill(0xff));
    expect(uuidv7(0)).toBe('00000000-0000-7fff-bfff-ffffffffffff');
    setRandomSource((n) => {
      const b = new Uint8Array(n);
      globalThis.crypto.getRandomValues(b);
      return b;
    });
  });
});
