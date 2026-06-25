import { put, list } from '@vercel/blob';
import { createHash, randomBytes } from 'crypto';

const COMPETITION_SLUG = (process.env.COMPETITION_SLUG || 'privattribedk').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
const BLOB_NAME = process.env.BLOB_DATA_FILE || `wc2026-${COMPETITION_SLUG}.json`;
const ADMIN_PASS = String(process.env.ADMIN_PASSWORD || '').trim();
const BLOB_ACCESS = process.env.BLOB_ACCESS || 'public';
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
const SIMPLE_REQUIRED_FIELDS = ['top1', 'top2', 'top3', 'top4', 'topscorer', 'golden_ball', 'most_yellow', 'most_goals_team'];
const ADV_GROUP_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const ADV_FUN_KEYS = ['topscorer', 'golden_ball', 'golden_glove', 'most_assist', 'most_goals_match', 'total_goals', 'most_yellow', 'most_red', 'own_goals', 'most_goals_team'];
const R32_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16'];
const R16_IDS = ['r16_0', 'r16_1', 'r16_2', 'r16_3', 'r16_4', 'r16_5', 'r16_6', 'r16_7'];
const QF_IDS = ['qf_0', 'qf_1', 'qf_2', 'qf_3'];
const SF_IDS = ['sf_0', 'sf_1'];
const EDIT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EDIT_CODE_LENGTH = 8;
const DEFAULT_INITIAL_EDIT_CODE = '123456';
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_STORE = new Map();
let CACHED_BLOB_URL = null;

// VM 2026 kickoff: 11. juni 2026 kl. 21:00 CEST (UTC+2) = 19:00 UTC
const REVEAL_DATE = new Date('2026-06-11T19:00:00Z');

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function hasValue(v) {
  if (typeof v === 'string') return v.trim().length > 0;
  return v !== null && v !== undefined;
}

function normalizeEditCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidEditCode(code) {
  const normalized = normalizeEditCode(code);
  return normalized.length >= 6 && normalized.length <= 20;
}

function isDefaultInitialCode(code) {
  return normalizeEditCode(code) === DEFAULT_INITIAL_EDIT_CODE;
}

function usesDefaultEditCode(entry) {
  return entry?.usesDefaultEditCode !== false;
}

function matchesEditCode(entry, code) {
  const normalized = normalizeEditCode(code);
  if (!normalized) return false;
  if (entry?.editCodeHash && hashEditCode(normalized) === entry.editCodeHash) return true;
  return usesDefaultEditCode(entry) && isDefaultInitialCode(normalized);
}

function hashEditCode(code) {
  return createHash('sha256').update(`${COMPETITION_SLUG}:${normalizeEditCode(code)}`).digest('hex');
}

function generateEditCode() {
  const bytes = randomBytes(EDIT_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < EDIT_CODE_LENGTH; i += 1) {
    out += EDIT_CODE_ALPHABET[bytes[i] % EDIT_CODE_ALPHABET.length];
  }
  return out;
}

function createUniqueEditCode(existingHashes) {
  for (let i = 0; i < 10; i += 1) {
    const code = generateEditCode();
    if (!existingHashes.has(hashEditCode(code))) return code;
  }
  throw new Error('Kunne ikke generere unik redigeringskode');
}

function pruneRateLimitStore(nowMs) {
  for (const [key, value] of RATE_LIMIT_STORE.entries()) {
    if (value.resetAt <= nowMs) RATE_LIMIT_STORE.delete(key);
  }
}

function getRequestIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function rateLimit(req, scope, limit) {
  const nowMs = Date.now();
  pruneRateLimitStore(nowMs);
  const key = `${scope}:${getRequestIp(req)}`;
  const current = RATE_LIMIT_STORE.get(key);
  if (!current || current.resetAt <= nowMs) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS });
    return null;
  }
  current.count += 1;
  RATE_LIMIT_STORE.set(key, current);
  if (current.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - nowMs) / 1000));
    return { retryAfterSeconds };
  }
  return null;
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

function hasAllKeys(obj, keys) {
  return keys.every(k => hasValue(obj?.[k]));
}

function isSimplePredictionComplete(prediction) {
  return hasAllKeys(prediction, SIMPLE_REQUIRED_FIELDS);
}

function isAdvancedPredictionComplete(prediction) {
  const g = prediction?.g || {};
  const third = prediction?.third || [];
  const bracket = prediction?.bracket || {};
  const fun = prediction?.fun || {};

  const groupsOk = ADV_GROUP_KEYS.every(k => hasValue(g?.[k]?.p1) && hasValue(g?.[k]?.p2) && hasValue(g?.[k]?.p3));
  const thirdOk = Array.isArray(third) && third.length === 8;
  const bracketOk =
    hasAllKeys(bracket?.r32 || {}, R32_IDS) &&
    hasAllKeys(bracket?.r16 || {}, R16_IDS) &&
    hasAllKeys(bracket?.qf || {}, QF_IDS) &&
    hasAllKeys(bracket?.sf || {}, SF_IDS) &&
    hasValue(bracket?.final?.fin) &&
    hasValue(bracket?.bronze?.bronze_w);
  const funOk = hasAllKeys(fun, ADV_FUN_KEYS);

  return groupsOk && thirdOk && bracketOk && funOk;
}

function validatePrediction(mode, prediction) {
  if (mode === 'simple') {
    return isSimplePredictionComplete(prediction)
      ? null
      : 'Du skal udfylde alle felter i Hurtig mode før indsendelse.';
  }
  if (mode === 'advanced') {
    return isAdvancedPredictionComplete(prediction)
      ? null
      : 'Du skal udfylde alle felter i Fodboldinteresseret mode før indsendelse.';
  }
  return null;
}

async function readBlob() {
  try {
    if (CACHED_BLOB_URL) {
      try {
        const cachedRes = await fetch(CACHED_BLOB_URL + `?t=${Date.now()}`, { cache: 'no-store' });
        if (cachedRes.ok) {
          return await cachedRes.json();
        }
      } catch {
        // Fall back to list lookup below.
      }
    }

    const { blobs } = await list({ prefix: BLOB_NAME });
    if (!blobs.length) return { colleagues: [], results: {} };
    CACHED_BLOB_URL = blobs[0].url;
    const res = await fetch(CACHED_BLOB_URL + `?t=${Date.now()}`, { cache: 'no-store' });
    return await res.json();
  } catch { return { colleagues: [], results: {} }; }
}

async function readBlobByUrl(url) {
  try {
    const res = await fetch(url + `?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeBlob(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN mangler i Vercel Environment Variables');
  }
  if (!['public', 'private'].includes(BLOB_ACCESS)) {
    throw new Error('BLOB_ACCESS skal vaere enten public eller private');
  }
  const blob = await put(BLOB_NAME, JSON.stringify(data), {
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
  if (blob?.url) {
    CACHED_BLOB_URL = blob.url;
  }
}

async function saveWithRetry({ buildEntry, verifyEntry, maxAttempts = 4 }) {
  let lastPayload = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await readBlob();
    const next = cloneData(data);
    const payload = buildEntry(next);
    if (payload?.status && payload.status !== 200) return payload;
    await writeBlob(next);
    const verifyData = await readBlob();
    if (verifyEntry(verifyData)) {
      return payload;
    }
    lastPayload = payload;
  }
  return lastPayload || { status: 409, payload: { error: 'Kunne ikke gemme stabilt. Proev igen.' } };
}

export default async function handler(req, res) {
  try {
    const requestOrigin = String(req.headers?.origin || '').trim();
    if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
      const data = await readBlob();
      const isAdmin = !!ADMIN_PASS && req.query.password === ADMIN_PASS;
      const revealed = new Date() >= REVEAL_DATE;

      // Build colleague lists depending on whether requester is admin
      const colleaguesForAdmin = (data.colleagues || []).map(({ editCodeHash, editCode, ...rest }) => ({ ...rest, editCode }));
      const colleaguesForPublic = (data.colleagues || []).map(({ editCodeHash, editCode, ...rest }) => rest);

      if (!revealed && !isAdmin) {
        // Strip predictions - only return name, mode, submittedAt
        return res.status(200).json({
          ...data,
          revealed: false,
          revealDate: REVEAL_DATE.toISOString(),
          colleagues: (colleaguesForPublic || []).map(({ name, mode, submittedAt }) => ({ name, mode, submittedAt })),
        });
      }

      return res.status(200).json({
        ...data,
        revealed: true,
        revealDate: REVEAL_DATE.toISOString(),
        colleagues: isAdmin ? colleaguesForAdmin : colleaguesForPublic
      });
    }

    if (req.method === 'POST') {
      const action = req.query.action;
      const body = req.body || {};

      const loginRate = action === 'mine' ? rateLimit(req, 'mine', 30) : null;
      if (loginRate) {
        res.setHeader('Retry-After', String(loginRate.retryAfterSeconds));
        return res.status(429).json({ error: 'For mange loginforsoeg. Proev igen senere.' });
      }

      const writeRate = (action === 'submit' || action === 'autosave') ? rateLimit(req, action, 120) : null;
      if (writeRate) {
        res.setHeader('Retry-After', String(writeRate.retryAfterSeconds));
        return res.status(429).json({ error: 'For mange gem-forsog. Vent lidt og proev igen.' });
      }

      const savePrediction = async ({ name, mode, prediction, editCode, newEditCode, adminPassword, allowIncomplete }) => {
        if (!name?.trim()) return { status: 400, payload: { error: 'Navn mangler' } };

        const isAdminSubmit = !!ADMIN_PASS && adminPassword === ADMIN_PASS;
        if (!allowIncomplete && !isAdminSubmit) {
          const predictionError = validatePrediction(mode, prediction);
          if (predictionError) return { status: 400, payload: { error: predictionError } };
        }

        if (!isAdminSubmit && new Date() >= REVEAL_DATE) {
          return { status: 403, payload: { error: 'AEndringer er lukket efter 11. juni 2026 kl. 21:00.' } };
        }

        const normalizedCode = normalizeEditCode(editCode);
        const normalizedNewCode = normalizeEditCode(newEditCode);
        if (normalizedNewCode && !isValidEditCode(normalizedNewCode)) {
          return { status: 400, payload: { error: 'Ny redigeringskode skal vaere 6-20 tegn (A-Z, 0-9)' } };
        }

        const normalizedName = normalizeName(name);
        const trimmedName = name.trim().replace(/\s+/g, ' ');
        const saveId = randomBytes(8).toString('hex');

        const result = await saveWithRetry({
          buildEntry: (data) => {
            const colleagues = Array.isArray(data.colleagues) ? data.colleagues : [];
            data.colleagues = colleagues;
            const idx = colleagues.findIndex(c => normalizeName(c.name) === normalizedName);
            const existingHashes = new Set(colleagues.map(c => c.editCodeHash).filter(Boolean));

            let resolvedCode = normalizedNewCode || normalizedCode;
            let codeGenerated = false;
            let codeChanged = false;
            const nowIso = new Date().toISOString();

            if (normalizedNewCode && isDefaultInitialCode(normalizedNewCode)) {
              return { status: 400, payload: { error: 'Ny redigeringskode maa ikke vaere standardkoden 123456' } };
            }

            if (idx >= 0) {
              const existing = colleagues[idx];
              if (existing?.editCodeHash) {
                if (!normalizedCode) {
                  return {
                    status: 409,
                    payload: {
                      error: 'Denne forudsigelse findes allerede. Indtast din redigeringskode for at opdatere.'
                    }
                  };
                }
                if (!matchesEditCode(existing, normalizedCode)) {
                  return { status: 403, payload: { error: 'Forkert redigeringskode' } };
                }

                if (normalizedNewCode) {
                  const nextHash = hashEditCode(normalizedNewCode);
                  if (nextHash !== existing.editCodeHash && existingHashes.has(nextHash)) {
                    return { status: 409, payload: { error: 'Den nye redigeringskode er allerede i brug' } };
                  }
                  codeChanged = nextHash !== existing.editCodeHash || usesDefaultEditCode(existing);
                } else if (usesDefaultEditCode(existing)) {
                  resolvedCode = createUniqueEditCode(existingHashes);
                  codeGenerated = true;
                  codeChanged = true;
                }
              } else {
                if (normalizedNewCode) {
                  const nextHash = hashEditCode(normalizedNewCode);
                  if (existingHashes.has(nextHash)) {
                    return { status: 409, payload: { error: 'Den nye redigeringskode er allerede i brug' } };
                  }
                  codeChanged = true;
                }
                if (!resolvedCode || isDefaultInitialCode(resolvedCode)) {
                  resolvedCode = createUniqueEditCode(existingHashes);
                  codeGenerated = true;
                  codeChanged = true;
                }
              }

              const entry = {
                ...existing,
                name: trimmedName,
                mode,
                prediction,
                submittedAt: nowIso,
                editCodeHash: hashEditCode(resolvedCode),
                editCode: resolvedCode,
                usesDefaultEditCode: false,
                lastSaveId: saveId
              };
              colleagues[idx] = entry;
            } else {
              if (normalizedNewCode) {
                const nextHash = hashEditCode(normalizedNewCode);
                if (existingHashes.has(nextHash)) {
                  return { status: 409, payload: { error: 'Redigeringskoden er allerede i brug' } };
                }
              }
              if (!resolvedCode || isDefaultInitialCode(resolvedCode)) {
                resolvedCode = createUniqueEditCode(existingHashes);
                codeGenerated = true;
              }
              const nextHash = hashEditCode(resolvedCode);
              if (existingHashes.has(nextHash)) {
                return { status: 409, payload: { error: 'Redigeringskoden er allerede i brug' } };
              }
              const entry = {
                name: trimmedName,
                mode,
                prediction,
                submittedAt: nowIso,
                editCodeHash: nextHash,
                editCode: resolvedCode,
                usesDefaultEditCode: false,
                lastSaveId: saveId
              };
              colleagues.push(entry);
            }

            return { status: 200, payload: { ok: true, editCode: resolvedCode, codeGenerated, codeChanged } };
          },
          verifyEntry: (verifyData) => {
            const verifyEntry = (verifyData?.colleagues || []).find(c => normalizeName(c.name) === normalizedName);
            return !!verifyEntry && verifyEntry.lastSaveId === saveId;
          }
        });

        return result;
      };

      if (action === 'verify') {
        if (!ADMIN_PASS) return res.status(503).json({ error: 'ADMIN_PASSWORD er ikke konfigureret' });
        const { password } = body;
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        return res.status(200).json({ ok: true });
      }

      if (action === 'mine') {
        const { name, editCode } = body;
        if (!name?.trim()) return res.status(400).json({ error: 'Navn mangler' });
        const normalizedCode = normalizeEditCode(editCode);
        if (!normalizedCode) return res.status(400).json({ error: 'Redigeringskode mangler' });

        const data = await readBlob();
        const normalized = normalizeName(name);
        const entry = (data.colleagues || []).find(c => normalizeName(c.name) === normalized);
        if (!entry) return res.status(404).json({ error: 'Ingen forudsigelse fundet for navnet' });
        if (!matchesEditCode(entry, normalizedCode)) {
          return res.status(403).json({ error: 'Forkert redigeringskode' });
        }

        const { editCodeHash, usesDefaultEditCode: defaultCodeFlag, ...safeEntry } = entry;
        return res.status(200).json({ ok: true, entry: safeEntry });
      }

      if (action === 'adminImport') {
        if (!ADMIN_PASS) return res.status(503).json({ error: 'ADMIN_PASSWORD er ikke konfigureret' });
        const { password, name, mode, prediction } = body;
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        if (!name?.trim()) return res.status(400).json({ error: 'Navn mangler' });
        if (!['simple', 'advanced'].includes(mode)) return res.status(400).json({ error: 'Ugyldig mode' });
        if (!prediction || typeof prediction !== 'object') return res.status(400).json({ error: 'Ugyldig forudsigelse' });

        const data = await readBlob();
        const normalized = normalizeName(name);
        const idx = data.colleagues.findIndex(c => normalizeName(c.name) === normalized);
        const existing = idx >= 0 ? data.colleagues[idx] : null;
        const entry = {
          name: name.trim().replace(/\s+/g, ' '),
          mode,
          prediction,
          submittedAt: new Date().toISOString(),
          editCodeHash: existing?.editCodeHash || null,
          editCode: existing?.editCode || null,
          usesDefaultEditCode: existing?.usesDefaultEditCode !== false
        };
        if (idx >= 0) data.colleagues[idx] = entry;
        else data.colleagues.push(entry);
        await writeBlob(data);
        return res.status(200).json({ ok: true });
      }

      if (action === 'scanBlobs') {
        if (!ADMIN_PASS) return res.status(503).json({ error: 'ADMIN_PASSWORD er ikke konfigureret' });
        const { password } = body;
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });

        const prefixes = ['wc2026-', BLOB_NAME.replace(/\.json$/i, '')];
        const uniqueBlobs = new Map();
        for (const prefix of prefixes) {
          const { blobs } = await list({ prefix });
          for (const blob of blobs || []) {
            uniqueBlobs.set(blob.pathname || blob.url, blob);
          }
        }

        const details = [];
        for (const blob of uniqueBlobs.values()) {
          const json = await readBlobByUrl(blob.url);
          const colleagues = Array.isArray(json?.colleagues) ? json.colleagues : [];
          const participants = Array.isArray(json?.participants) ? json.participants : [];
          const predictions = Array.isArray(json?.predictions) ? json.predictions : [];
          const entries = Array.isArray(json?.entries) ? json.entries : [];
          const records = Array.isArray(json?.records) ? json.records : [];
          const sampleNames = colleagues.slice(0, 20).map((c) => c?.name).filter(Boolean);
          details.push({
            pathname: blob.pathname,
            uploadedAt: blob.uploadedAt,
            size: blob.size,
            colleaguesCount: colleagues.length,
            participantsCount: participants.length,
            predictionsCount: predictions.length,
            entriesCount: entries.length,
            recordsCount: records.length,
            topLevelKeys: json && typeof json === 'object' ? Object.keys(json).slice(0, 30) : [],
            sampleNames
          });
        }

        details.sort((a, b) => (b.colleaguesCount || 0) - (a.colleaguesCount || 0));
        return res.status(200).json({ ok: true, currentBlob: BLOB_NAME, blobs: details });
      }

      if (action === 'submit') {
        const result = await savePrediction({ ...body, allowIncomplete: false });
        return res.status(result.status).json(result.payload);
      }

      if (action === 'autosave') {
        const result = await savePrediction({ ...body, allowIncomplete: true });
        if (result.status !== 200) return res.status(result.status).json(result.payload);
        return res.status(200).json({ ...result.payload, autosaved: true });
      }

      if (action === 'results') {
        if (!ADMIN_PASS) return res.status(503).json({ error: 'ADMIN_PASSWORD er ikke konfigureret' });
        const { results, password } = body;
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        const data = await readBlob();
        data.results = results;
        await writeBlob(data);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Ukendt action' });
    }

    if (req.method === 'DELETE') {
      const { action, name, password } = req.query;

      if (action === 'clearAll') {
        if (!ADMIN_PASS) return res.status(503).json({ error: 'ADMIN_PASSWORD er ikke konfigureret' });
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        const data = await readBlob();
        data.colleagues = [];
        await writeBlob(data);
        return res.status(200).json({ ok: true });
      }

      if (name) {
        if (!ADMIN_PASS) return res.status(503).json({ error: 'ADMIN_PASSWORD er ikke konfigureret' });
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        const data = await readBlob();
        const target = normalizeName(name);
        const before = (data.colleagues || []).length;
        data.colleagues = (data.colleagues || []).filter(c => normalizeName(c.name) !== target);
        const deleted = before - data.colleagues.length;
        if (deleted === 0) {
          return res.status(404).json({ error: 'Kunne ikke finde forudsigelsen der skulle slettes' });
        }
        await writeBlob(data);
        return res.status(200).json({ ok: true, deleted });
      }

      return res.status(400).json({ error: 'Mangler parametre' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Uventet serverfejl' });
  }
}
