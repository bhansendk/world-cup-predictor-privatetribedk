import { put, list } from '@vercel/blob';

const COMPETITION_SLUG = (process.env.COMPETITION_SLUG || 'privattribedk').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
const BLOB_NAME = process.env.BLOB_DATA_FILE || `wc2026-${COMPETITION_SLUG}.json`;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
const BLOB_ACCESS = process.env.BLOB_ACCESS || 'public';
const SIMPLE_REQUIRED_FIELDS = ['top1', 'top2', 'top3', 'top4', 'topscorer', 'golden_ball', 'most_yellow', 'most_goals_team'];
const ADV_GROUP_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const ADV_FUN_KEYS = ['topscorer', 'golden_ball', 'golden_glove', 'most_assist', 'most_goals_match', 'total_goals', 'most_yellow', 'most_red', 'own_goals', 'most_goals_team'];
const R32_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16'];
const R16_IDS = ['r16_0', 'r16_1', 'r16_2', 'r16_3', 'r16_4', 'r16_5', 'r16_6', 'r16_7'];
const QF_IDS = ['qf_0', 'qf_1', 'qf_2', 'qf_3'];
const SF_IDS = ['sf_0', 'sf_1'];

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
  return 'Ugyldig mode';
}

async function readBlob() {
  try {
    const { blobs } = await list({ prefix: BLOB_NAME });
    if (!blobs.length) return { colleagues: [], results: {} };
    const res = await fetch(blobs[0].url + `?t=${Date.now()}`, { cache: 'no-store' });
    return await res.json();
  } catch { return { colleagues: [], results: {} }; }
}

async function writeBlob(data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN mangler i Vercel Environment Variables');
  }
  if (!['public', 'private'].includes(BLOB_ACCESS)) {
    throw new Error('BLOB_ACCESS skal vaere enten public eller private');
  }
  await put(BLOB_NAME, JSON.stringify(data), {
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
      const data = await readBlob();
      const isAdmin = req.query.password === ADMIN_PASS;
      const revealed = new Date() >= REVEAL_DATE;
      if (!revealed && !isAdmin) {
        // Strip predictions - only return name, mode, submittedAt
        return res.status(200).json({
          ...data,
          revealed: false,
          revealDate: REVEAL_DATE.toISOString(),
          colleagues: data.colleagues.map(({ name, mode, submittedAt }) => ({ name, mode, submittedAt })),
        });
      }
      return res.status(200).json({ ...data, revealed: true, revealDate: REVEAL_DATE.toISOString() });
    }

    if (req.method === 'POST') {
      const action = req.query.action;
      const body = req.body || {};

      if (action === 'verify') {
        const { password } = body;
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        return res.status(200).json({ ok: true });
      }

      if (action === 'adminImport') {
        const { password, name, mode, prediction } = body;
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        if (!name?.trim()) return res.status(400).json({ error: 'Navn mangler' });
        if (!['simple', 'advanced'].includes(mode)) return res.status(400).json({ error: 'Ugyldig mode' });
        if (!prediction || typeof prediction !== 'object') return res.status(400).json({ error: 'Ugyldig forudsigelse' });

        const data = await readBlob();
        const normalized = normalizeName(name);
        const idx = data.colleagues.findIndex(c => normalizeName(c.name) === normalized);
        const entry = { name: name.trim().replace(/\s+/g, ' '), mode, prediction, submittedAt: new Date().toISOString() };
        if (idx >= 0) data.colleagues[idx] = entry;
        else data.colleagues.push(entry);
        await writeBlob(data);
        return res.status(200).json({ ok: true });
      }

      if (action === 'submit') {
        const { name, mode, prediction } = body;
        if (!name?.trim()) return res.status(400).json({ error: 'Navn mangler' });
        const predictionError = validatePrediction(mode, prediction);
        if (predictionError) return res.status(400).json({ error: predictionError });
        if (new Date() >= REVEAL_DATE) {
          return res.status(403).json({ error: 'Tilmelding er lukket. VM er startet.' });
        }
        const data = await readBlob();
        const normalized = normalizeName(name);
        const idx = data.colleagues.findIndex(c => normalizeName(c.name) === normalized);
        const entry = { name: name.trim().replace(/\s+/g, ' '), mode, prediction, submittedAt: new Date().toISOString() };
        if (idx >= 0) data.colleagues[idx] = entry;
        else data.colleagues.push(entry);
        await writeBlob(data);
        return res.status(200).json({ ok: true });
      }

      if (action === 'results') {
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
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        const data = await readBlob();
        data.colleagues = [];
        await writeBlob(data);
        return res.status(200).json({ ok: true });
      }

      if (name) {
        if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Forkert adgangskode' });
        const data = await readBlob();
        data.colleagues = data.colleagues.filter(c => c.name.toLowerCase() !== name.toLowerCase());
        await writeBlob(data);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Mangler parametre' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Uventet serverfejl' });
  }
}
