// Supabase Edge Function: food search proxy for USDA FoodData Central.
// - Keeps the USDA API key on the server (secret USDA_API_KEY).
// - Trims responses to the fields the app uses and caches popular queries.
// Deploy: supabase functions deploy food-search --no-verify-jwt
import { createCache, createRateLimiter, trimUsdaResponse, usdaRequestBody, validateParams } from './trim.ts';

const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const cache = createCache<string>(500, 60 * 60 * 1000); // 1 hour
const allow = createRateLimiter(60, 60 * 1000); // 60 requests/minute per client IP

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!allow(ip, Date.now())) return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429, headers });

  const v = validateParams(new URL(req.url).searchParams);
  if (v.kind === 'error') return new Response(JSON.stringify({ error: v.message }), { status: 400, headers });

  const key = v.kind === 'barcode' ? `b:${v.barcode}` : `q:${v.query.toLowerCase()}`;
  const cached = cache.get(key, Date.now());
  if (cached) return new Response(cached, { headers: { ...headers, 'X-Cache': 'HIT' } });

  const apiKey = Deno.env.get('USDA_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers });

  const res = await fetch(`${USDA_URL}?api_key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(usdaRequestBody(v)),
  });
  if (!res.ok) return new Response(JSON.stringify({ error: `USDA error ${res.status}` }), { status: 502, headers });

  const body = JSON.stringify(trimUsdaResponse(await res.json()));
  cache.set(key, body, Date.now());
  return new Response(body, { headers: { ...headers, 'X-Cache': 'MISS' } });
});
