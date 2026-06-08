import { useEffect, useState } from 'react';
import { ALL_TEAMS, GROUPS, FUN_QUESTIONS, QF_PAIRS, R16_PAIRS, R32, SF_PAIRS } from '../../data/wc2026.js';
import { FlagSpan, TeamSelect } from '../FormFields.jsx';
import BracketTab from './Bracket.jsx';

const ROUND_LABELS = {
  r32: 'R32',
  r16: 'R16',
  qf: 'Kvartfinale',
  sf: 'Semifinale',
  final: 'Finale',
  bronze: 'Bronzekamp'
};

function emptyResults() {
  return {
    g: {},
    third: [],
    r32: {},
    r16: {},
    qf: {},
    sf: {},
    final: {},
    bronze: {},
    fun: {}
  };
}

function decodeImportText(rawText) {
  const input = (rawText || '').trim();
  if (!input) throw new Error('Tom tekststreng');

  const tryParsePayload = (payload) => {
    if (!payload || typeof payload !== 'object') return null;

    if (payload.mode === 'simple' && payload.simple) {
      return { mode: 'simple', prediction: payload.simple };
    }

    if (payload.mode === 'simple' && payload.prediction) {
      return { mode: 'simple', prediction: payload.prediction };
    }

    if (payload.mode === 'advanced' && payload.g && payload.bracket) {
      return {
        mode: 'advanced',
        prediction: {
          g: payload.g,
          third: Array.isArray(payload.third) ? payload.third : [],
          bracket: payload.bracket,
          fun: payload.fun || {}
        }
      };
    }

    if (payload.g && payload.bracket) {
      return {
        mode: 'advanced',
        prediction: {
          g: payload.g,
          third: Array.isArray(payload.third) ? payload.third : [],
          bracket: payload.bracket,
          fun: payload.fun || {}
        }
      };
    }

    return null;
  };

  const tryDecodeCandidate = (candidate) => {
    if (!candidate) return null;

    try {
      const json = JSON.parse(candidate);
      const parsed = tryParsePayload(json);
      if (parsed) return parsed;
    } catch {}

    const normalized = candidate.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = normalized.length % 4;
    const padded = normalized + (padLen ? '='.repeat(4 - padLen) : '');

    try {
      const decodedUnicode = decodeURIComponent(escape(atob(padded)));
      const json = JSON.parse(decodedUnicode);
      const parsed = tryParsePayload(json);
      if (parsed) return parsed;
    } catch {}

    try {
      const decoded = atob(padded);
      const json = JSON.parse(decoded);
      const parsed = tryParsePayload(json);
      if (parsed) return parsed;
    } catch {}

    return null;
  };

  const candidates = [input];
  const queryMatch = input.match(/[?&]p=([^&]+)/);
  if (queryMatch?.[1]) candidates.push(decodeURIComponent(queryMatch[1]));

  const tokens = input.match(/[A-Za-z0-9+/_=-]{40,}/g) || [];
  tokens.forEach(t => candidates.push(t));

  for (const c of candidates) {
    const result = tryDecodeCandidate(c);
    if (result) return result;
  }

  throw new Error('Kunne ikke aflæse import-teksten');
}

function AdminPanel({ adminUpdate, adminVerify, adminLogout, isAdmin, adminPassword, adminDelete, adminClearAll, onSubmit, loading, colleagues, serverData }) {
  const [pw, setPw] = useState('');
  const [status, setStatus] = useState('');
  const [importName, setImportName] = useState('');
  const [importText, setImportText] = useState('');
  const [resultState, setResultState] = useState(() => ({ ...emptyResults(), ...(serverData?.results || {}) }));
  const [localColleagues, setLocalColleagues] = useState(colleagues || []);

  useEffect(() => {
    setLocalColleagues(colleagues || []);
  }, [colleagues]);

  useEffect(() => {
    setResultState({ ...emptyResults(), ...(serverData?.results || {}) });
  }, [serverData?.results]);

  const handleLogin = async () => {
    if (!pw.trim()) {
      setStatus('❌ Indtast adgangskode først');
      return;
    }
    const res = await adminVerify(pw);
    if (res.ok) {
      setPw('');
      setStatus('✅ Logget ind som admin');
      return;
    }
    setStatus('❌ ' + res.error);
  };

  const logout = () => {
    adminLogout();
    setPw('');
    setStatus('');
  };

  const activePw = adminPassword || pw;

  const handleSaveResults = async () => {
    if (!isAdmin) {
      setStatus('❌ Log ind først');
      return;
    }
    const res = await adminUpdate(resultState, activePw);
    if (res.ok) setStatus('✅ Resultater gemt!');
    else setStatus('❌ ' + res.error);
  };

  const handleDeleteAll = async () => {
    if (!isAdmin) {
      setStatus('❌ Log ind først');
      return;
    }
    if (!confirm('Slet alle deltagere?')) return;
    const res = await adminClearAll(activePw);
    if (res.ok) {
      setLocalColleagues([]);
      setStatus('✅ Alle slettet');
    }
    else setStatus('❌ ' + res.error);
  };

  const handleDeleteOne = async (name) => {
    if (!isAdmin) {
      setStatus('❌ Log ind først');
      return;
    }
    const res = await adminDelete(name, activePw);
    if (res.ok) {
      setLocalColleagues(prev => prev.filter(c => c.name !== name));
      setStatus(`✅ ${name} slettet`);
    }
    else setStatus('❌ ' + res.error);
  };

  const handleImportText = async () => {
    if (!isAdmin) {
      setStatus('❌ Log ind først');
      return;
    }
    if (!importName.trim()) {
      setStatus('❌ Indtast navn på kollega');
      return;
    }
    if (!importText.trim()) {
      setStatus('❌ Indsæt tekststreng til import');
      return;
    }

    try {
      const parsed = decodeImportText(importText);
      const res = await onSubmit(importName.trim(), parsed.mode, parsed.prediction);
      if (res.ok) {
        setImportName('');
        setImportText('');
        setStatus(`✅ Importeret forudsigelse for ${importName.trim()} (${parsed.mode === 'simple' ? 'Hurtig' : 'Fodboldinteresseret'})`);
      } else {
        setStatus('❌ ' + (res.error || 'Import fejlede'));
      }
    } catch (e) {
      setStatus('❌ ' + e.message);
    }
  };

  const setGroupResult = (gKey, field, team) => {
    setResultState(prev => {
      const g = { ...(prev.g || {}), [gKey]: { ...(prev.g?.[gKey] || {}) } };
      const gs = g[gKey];
      // toggle
      if (gs[field] === team) { gs[field] = ''; }
      else {
        // remove team from other slots
        if (gs.p1 === team) gs.p1 = '';
        if (gs.p2 === team) gs.p2 = '';
        if (gs.p3 === team) gs.p3 = '';
        gs[field] = team;
      }
      return { ...prev, g };
    });
  };

  const setFunResult = (id, val) => {
    setResultState(prev => ({ ...prev, fun: { ...(prev.fun || {}), [id]: val } }));
  };

  const toggleThirdGroup = (groupKey) => {
    setResultState(prev => {
      const current = Array.isArray(prev.third) ? prev.third : [];
      const exists = current.includes(groupKey);
      if (exists) return { ...prev, third: current.filter(x => x !== groupKey) };
      if (current.length >= 8) return prev;
      return { ...prev, third: [...current, groupKey] };
    });
  };

  const setKnockoutWinner = (round, id, team) => {
    setResultState(prev => ({
      ...prev,
      [round]: {
        ...(prev[round] || {}),
        [id]: (prev[round] || {})[id] === team ? null : team
      }
    }));
  };

  const third = Array.isArray(resultState.third) ? resultState.third : [];

  return (
    <div>
      <div className="admin-auth">
        <input
          type="password"
          placeholder="Admin-adgangskode"
          value={pw}
          onChange={e => setPw(e.target.value)}
          className="name-input"
        />
        {!isAdmin ? (
          <button className="btn-accent" onClick={handleLogin} disabled={loading}>🔐 Log ind</button>
        ) : (
          <button className="btn-ghost" onClick={logout} disabled={loading}>🔓 Log ud</button>
        )}
        {status && <span className="status-msg">{status}</span>}
      </div>

      {!isAdmin && (
        <div className="info-card" style={{ marginBottom: 16 }}>
          <p>Log ind som admin for at redigere resultater, bracket og deltagere.</p>
        </div>
      )}

      {isAdmin && (
        <>

      <div className="section-card">
        <h3>👥 Deltagere</h3>
        <div className="participants-list">
          {localColleagues.map(c => (
            <div key={c.name} className="participant-chip">
              {c.name} <span className="chip-mode">{c.mode === 'simple' ? '⚡' : '⭐'}</span>
              <button className="btn-danger-sm" onClick={() => handleDeleteOne(c.name)}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn-danger btn-sm" onClick={handleDeleteAll}>🗑️ Slet alle</button>
      </div>

      <div className="section-card">
        <h3>📥 Importér kollegas tekststreng</h3>
        <p style={{ color: '#94a3b8', marginBottom: 10 }}>
          Indsæt den lange tekststreng fra "Kopier som tekst (til import)" fra en kollega.
        </p>
        <div className="submit-row" style={{ marginBottom: 8 }}>
          <input
            type="text"
            className="name-input"
            placeholder="Kollegaens navn"
            value={importName}
            onChange={e => setImportName(e.target.value)}
          />
        </div>
        <textarea
          className="name-input"
          style={{ minHeight: 120, resize: 'vertical' }}
          placeholder="Indsæt tekststreng her..."
          value={importText}
          onChange={e => setImportText(e.target.value)}
        />
        <div className="submit-row">
          <button className="btn-accent" onClick={handleImportText} disabled={loading}>➕ Importér forudsigelse</button>
        </div>
      </div>

      <div className="section-card">
        <h3>🏟️ Grupperesultater</h3>
        <div className="groups-grid">
          {Object.entries(GROUPS).map(([key, g]) => {
            const gs = (resultState.g || {})[key] || {};
            const ranks = [gs.p1, gs.p2, gs.p3];
            const filled = ranks.filter(Boolean).length;
            return (
              <div key={key} className="group-card">
                <div className="group-title">{g.name}</div>
                <div className="group-progress">{filled}/3</div>
                <div className="team-list">
                  {g.teams.map((team) => {
                    const rank = ranks.indexOf(team);
                    let cls = 'team-item';
                    let badge = '';
                    if (rank === 0) { cls += ' s1'; badge = ' 🥇'; }
                    else if (rank === 1) { cls += ' s2'; badge = ' 🥈'; }
                    else if (rank === 2) { cls += ' s3'; badge = ' 🥉'; }
                    else if (filled >= 3) cls += ' dimmed';
                    const clickRank = rank >= 0
                      ? () => setGroupResult(key, ['p1','p2','p3'][rank], '')
                      : () => {
                          const slot = !gs.p1 ? 'p1' : !gs.p2 ? 'p2' : !gs.p3 ? 'p3' : null;
                          if (slot) setGroupResult(key, slot, team);
                        };
                    return (
                      <div key={team} className={cls} onClick={clickRank}>
                        <FlagSpan team={team} />{team}{badge}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-card">
        <h3>🥉 8 bedste 3'ere ({third.length}/8)</h3>
        <div className="third-grid">
          {Object.entries(GROUPS).map(([key, g]) => {
            const p3 = (resultState.g?.[key] || {}).p3;
            const isSel = third.includes(key);
            const isBlocked = !isSel && third.length >= 8;
            return (
              <div
                key={key}
                className={'third-item' + (isSel ? ' sel' : '') + (isBlocked ? ' blocked' : '')}
                onClick={() => !isBlocked && toggleThirdGroup(key)}
              >
                {p3 ? <FlagSpan team={p3} /> : null}
                <strong>{g.name}</strong>
                <br />
                <small style={{ color: p3 ? '#94a3b8' : '#475569' }}>
                  {p3 ? `3'er: ${p3}` : "3'er ikke sat"}
                </small>
                {isSel && <span className="t-badge">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-card">
        <h3>🏆 Knockout-resultater</h3>
        <p style={{ color: '#94a3b8', marginBottom: 12 }}>
          Udfyld grupper og 8 bedste 3'ere. Herefter kan knockout resultater sættes direkte i bracketen.
          Bracketen opdateres automatisk når nye resultater hentes fra serveren.
        </p>
        <BracketTab
          S={resultState}
          onPick={setKnockoutWinner}
          showHeader={false}
          notReadyMessage="Udfyld grupper og 8 bedste 3'ere for at aktivere knockout-bracketen."
        />
      </div>

      <div className="section-card">
        <h3>🎯 Sjove tips resultater</h3>
        <div className="fun-grid">
          {FUN_QUESTIONS.map(q => (
            <div key={q.id} className="fun-card">
              <div className="fun-card-header">
                <span className="fun-title">{q.title}</span>
              </div>
              <div className="select-wrap">
                <select
                  value={(resultState.fun || {})[q.id] || ''}
                  onChange={e => setFunResult(q.id, e.target.value || null)}
                >
                  <option value="">– Vælg facit –</option>
                  {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="submit-row">
        <button className="btn-primary" onClick={handleSaveResults} disabled={loading}>
          {loading ? 'Gemmer…' : '💾 Gem alle resultater'}
        </button>
      </div>
      </>
      )}
    </div>
  );
}

export default function ResultaterTab({ serverData, onSubmit, adminUpdate, adminVerify, adminLogout, isAdmin, adminPassword, adminDelete, adminClearAll, loading }) {
  const [adminOpen, setAdminOpen] = useState(false);
  const colleagues = serverData?.colleagues || [];

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>✅ Resultater (Admin)</h2>
        <p>Kun arrangøren skal udfylde dette panel.</p>
        <button className="btn-accent" onClick={() => setAdminOpen(!adminOpen)}>
          {adminOpen ? '🔒 Luk admin' : '🔓 Åbn admin-panel'}
        </button>
      </div>
      {adminOpen && (
        <AdminPanel
          adminUpdate={adminUpdate}
          adminVerify={adminVerify}
          adminLogout={adminLogout}
          isAdmin={isAdmin}
          adminPassword={adminPassword}
          adminDelete={adminDelete}
          adminClearAll={adminClearAll}
          onSubmit={onSubmit}
          loading={loading}
          colleagues={colleagues}
          serverData={serverData}
        />
      )}
      {!adminOpen && (
        <div className="info-card">
          <p>Klik "Åbn admin-panel" og indtast adgangskoden for at registrere resultater og administrere deltagere.</p>
        </div>
      )}
    </div>
  );
}
