import { list, put } from '@vercel/blob';
import { createImportedResultsFromFootballData } from './_footballDataWorldCup.js';

const COMPETITION_SLUG = (process.env.COMPETITION_SLUG || 'privattribedk').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
const BLOB_NAME = process.env.BLOB_DATA_FILE || `wc2026-${COMPETITION_SLUG}.json`;
const ADMIN_PASS = String(process.env.ADMIN_PASSWORD || '').trim();
const BLOB_ACCESS = process.env.BLOB_ACCESS || 'public';
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);

const FOOTBALL_DATA_BASE_URL = String(process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4').replace(/\/$/, '');
const FOOTBALL_DATA_TOKEN = String(process.env.FOOTBALL_DATA_TOKEN || process.env.FOOTBALL_API_KEY || '').trim();
const FOOTBALL_DATA_COMPETITION_ID = String(process.env.FOOTBALL_DATA_COMPETITION_ID || '').trim();
const FOOTBALL_DATA_SEASON = String(process.env.FOOTBALL_DATA_SEASON || '2026').trim();

let CACHED_BLOB_URL = null;

function setCors(req, res) {
  const requestOrigin = String(req.headers?.origin || '').trim();
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

async function readBlob() {
  try {
    if (CACHED_BLOB_URL) {
      const cachedRes = await fetch(CACHED_BLOB_URL + `?t=${Date.now()}`, { cache: 'no-store' });
      if (cachedRes.ok) return await cachedRes.json();
    }
  } catch {}

  const { blobs } = await list({ prefix: BLOB_NAME });
  if (!blobs.length) return { colleagues: [], results: {} };
  CACHED_BLOB_URL = blobs[0].url;
  const res = await fetch(CACHED_BLOB_URL + `?t=${Date.now()}`, { cache: 'no-store' });
  return await res.json();
}

async function writeBlob(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN mangler i Vercel Environment Variables');
  }
  const blob = await put(BLOB_NAME, JSON.stringify(data), {
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
  if (blob?.url) CACHED_BLOB_URL = blob.url;
}

function isAuthorized(req, body) {
  const suppliedPassword = String(body?.password || req.query?.password || '').trim();
  const userAgent = String(req.headers?.['user-agent'] || '');
  const isCron = userAgent.includes('vercel-cron/1.0');
  const isAdmin = !!ADMIN_PASS && suppliedPassword === ADMIN_PASS;
  return { isAdmin, isCron };
}

async function fetchFootballDataJson(path) {
  const response = await fetch(`${FOOTBALL_DATA_BASE_URL}${path}`, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_TOKEN,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Football API fejl (${response.status}): ${text.slice(0, 200)}`);
  }

  return await response.json();
}

async function importResultsFromFootballData() {
  if (!FOOTBALL_DATA_TOKEN) {
    throw new Error('FOOTBALL_DATA_TOKEN mangler');
  }
  if (!FOOTBALL_DATA_COMPETITION_ID) {
    throw new Error('FOOTBALL_DATA_COMPETITION_ID mangler');
  }

  const [standings, matches, scorers] = await Promise.all([
    fetchFootballDataJson(`/competitions/${encodeURIComponent(FOOTBALL_DATA_COMPETITION_ID)}/standings?season=${encodeURIComponent(FOOTBALL_DATA_SEASON)}`),
    fetchFootballDataJson(`/competitions/${encodeURIComponent(FOOTBALL_DATA_COMPETITION_ID)}/matches?season=${encodeURIComponent(FOOTBALL_DATA_SEASON)}&status=FINISHED`),
    fetchFootballDataJson(`/competitions/${encodeURIComponent(FOOTBALL_DATA_COMPETITION_ID)}/scorers?season=${encodeURIComponent(FOOTBALL_DATA_SEASON)}`)
  ]);

  const current = await readBlob();
  const importedResults = createImportedResultsFromFootballData({ standings, matches, scorers }, current?.results || {});
  const next = cloneData(current);
  next.results = {
    ...(current?.results || {}),
    ...importedResults,
    fun: {
      ...(current?.results?.fun || {}),
      ...(importedResults?.fun || {})
    },
    importedAt: new Date().toISOString(),
    importSource: 'football-data.org'
  };

  await writeBlob(next);
  return next.results;
}

export default async function handler(req, res) {
  try {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const body = req.body || {};
    const { isAdmin, isCron } = isAuthorized(req, body);

    if (req.method === 'GET' && !isCron && !isAdmin) {
      return res.status(401).json({ error: 'Kun admin eller Vercel cron må hente automatisk.' });
    }
    if (req.method === 'POST' && !isAdmin) {
      return res.status(401).json({ error: 'Forkert admin-adgangskode.' });
    }
    if (!['GET', 'POST'].includes(req.method)) {
      return res.status(405).json({ error: 'Metode ikke tilladt.' });
    }

    const results = await importResultsFromFootballData();
    return res.status(200).json({ ok: true, results, importedAt: results?.importedAt || new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Ukendt fejl ved import af resultater.' });
  }
}
