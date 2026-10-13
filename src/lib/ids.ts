// Row IDs.
// - newId(): UUID v7 (time-ordered random), for normal rows like food logs.
// - stableId(key): UUID v5 from a key such as "day:2026-10-12", for rows that must be
//   identical across devices ("one per day/week/sample"), so sync merges instead of duplicating.
// Pure TS: the random source is injected (expo-crypto in the app, WebCrypto in Node tests).

type RandomSource = (length: number) => Uint8Array;

let randomSource: RandomSource = (n) => {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

export function setRandomSource(source: RandomSource): void {
  randomSource = source;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export function uuidv7(now: number = Date.now()): string {
  const bytes = randomSource(16);
  // 48-bit big-endian millisecond timestamp.
  let ms = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return toHex(bytes);
}

export const newId = (): string => uuidv7();

// --- UUID v5 (SHA-1) ---

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function sha1(msg: Uint8Array): Uint8Array {
  const ml = msg.length;
  const withPadding = ((ml + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(withPadding);
  buf.set(msg);
  buf[ml] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(withPadding - 4, (ml * 8) >>> 0);
  view.setUint32(withPadding - 8, Math.floor((ml * 8) / 2 ** 32));

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < withPadding; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const [f, k] =
        i < 20 ? [(b & c) | (~b & d), 0x5a827999]
        : i < 40 ? [b ^ c ^ d, 0x6ed9eba1]
        : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
        : [b ^ c ^ d, 0xca62c1d6];
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]!) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

function parseUuid(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function uuidv5(name: string, namespace: string): string {
  const ns = parseUuid(namespace);
  const nm = utf8(name);
  const input = new Uint8Array(ns.length + nm.length);
  input.set(ns);
  input.set(nm, ns.length);
  const hash = sha1(input).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  return toHex(hash);
}

/** Fixed namespace for Burnrate's deterministic IDs. Never change it. */
export const BURNRATE_NAMESPACE = '6d1f4c1e-8a3b-4f0e-9c2d-5b7a1e3f9d42';

export const stableId = (key: string): string => uuidv5(key, BURNRATE_NAMESPACE);

export const ids = {
  profile: () => stableId('profile'),
  day: (date: string) => stableId(`day:${date}`),
  checkIn: (date: string) => stableId(`checkin:${date}`),
  steps: (source: string, date: string) => stableId(`steps:${source}:${date}`),
  healthSample: (source: string, externalId: string) => stableId(`${source}:${externalId}`),
};
