import { useState, useEffect, useMemo } from 'react';
import { calcScore, calcSimpleScore, extractSimpleFromAdvanced } from '../../lib/scoring.js';
import { FUN_QUESTIONS, GROUPS, QF_PAIRS, R16_PAIRS, R32, SF_PAIRS } from '../../data/wc2026.js';
import BracketTab from './Bracket.jsx';

// Reveal: 1. juni 2026 kl. 21:00 CEST = 19:00 UTC
const REVEAL_DATE = new Date('2026-06-01T19:00:00Z');
// Admin kan se alles forudsigelser i komprimeret visning før turneringsstart
const ADMIN_PREVIEW_UNTIL = new Date('2026-06-11T19:00:00Z');
const SIMPLE_FIELDS = [
  { key: 'top1', label: 'Mester' },
  { key: 'top2', label: 'Runner-up' },
  { key: 'top3', label: 'Nr. 3' },
  { key: 'top4', label: 'Nr. 4' },
  { key: 'topscorer', label: 'Topscorer' },
  { key: 'golden_ball', label: 'Gyldne Bold' },
  { key: 'most_yellow', label: 'Flest gule kort - hold' },
  { key: 'most_goals_team', label: 'Flest mål - hold' }
];

function isFilled(v) {
  if (typeof v === 'string') return v.trim().length > 0;
  return v !== null && v !== undefined;
}

function getSimpleMissing(simple) {
  return SIMPLE_FIELDS.filter(f => !isFilled(simple?.[f.key])).map(f => f.label);
}

function getAdvancedMissing(S, FUN) {
  const missing = [];
  const groupMissing = [];

  Object.keys(GROUPS).forEach(k => {
    const g = S?.g?.[k] || {};
    const slots = [];
    if (!isFilled(g.p1)) slots.push('1. plads');
    if (!isFilled(g.p2)) slots.push('2. plads');
    if (!isFilled(g.p3)) slots.push('3. plads');
    if (slots.length) groupMissing.push(`${GROUPS[k].name}: ${slots.join('/')}`);
  });

  if (groupMissing.length) {
    missing.push(`Grupper (${groupMissing.length}): ${groupMissing.slice(0, 4).join(', ')}${groupMissing.length > 4 ? ', ...' : ''}`);
  }

  const thirdCount = Array.isArray(S?.third) ? S.third.length : 0;
  if (thirdCount < 8) missing.push(`8 bedste 3'ere: mangler ${8 - thirdCount}`);

  const missingR32 = R32.filter(m => !isFilled(S?.r32?.[m.id])).length;
  const missingR16 = R16_PAIRS.filter((_, i) => !isFilled(S?.r16?.[`r16_${i}`])).length;
  const missingQF = QF_PAIRS.filter((_, i) => !isFilled(S?.qf?.[`qf_${i}`])).length;
  const missingSF = SF_PAIRS.filter((_, i) => !isFilled(S?.sf?.[`sf_${i}`])).length;
  const missingFinal = !isFilled(S?.final?.fin) ? 1 : 0;
  const missingBronze = !isFilled(S?.bronze?.bronze_w) ? 1 : 0;

  if (missingR32 || missingR16 || missingQF || missingSF || missingFinal || missingBronze) {
    missing.push(
      `Bracket: R32(${missingR32}), R16(${missingR16}), KF(${missingQF}), SF(${missingSF}), Finale(${missingFinal}), Bronze(${missingBronze})`
    );
  }

  const missingFun = FUN_QUESTIONS.filter(q => !isFilled(FUN?.[q.id])).map(q => q.title);
  if (missingFun.length) {
    missing.push(`Sjove tips (${missingFun.length}): ${missingFun.slice(0, 5).join(', ')}${missingFun.length > 5 ? ', ...' : ''}`);
  }

  return missing;
}

function useCountdown(target) {
  const [diff, setDiff] = useState(() => target - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return diff;
}

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${String(h).padStart(2,'0')}t ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
}

function compactList(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : '-';
  }
  return value || '-';
}

function getSimplePrediction(mode, prediction) {
  if (!prediction) return null;
  if (mode === 'simple') return prediction;
  return extractSimpleFromAdvanced(prediction?.bracket || {}, prediction?.fun || {});
}

function groupTeamsWithPlacement(groupKey, groupPrediction) {
  const teams = GROUPS[groupKey]?.teams || [];
  const p1 = groupPrediction?.p1 || null;
  const p2 = groupPrediction?.p2 || null;
  const p3 = groupPrediction?.p3 || null;
  const ordered = [p1, p2, p3].filter(Boolean);
  const unique = [];
  ordered.forEach(team => {
    if (!unique.includes(team)) unique.push(team);
  });
  teams.forEach(team => {
    if (!unique.includes(team)) unique.push(team);
  });
  return unique.slice(0, 4);
}

function predictionToBracketState(prediction) {
  return {
    g: prediction?.g || {},
    third: prediction?.third || [],
    r32: prediction?.bracket?.r32 || {},
    r16: prediction?.bracket?.r16 || {},
    qf: prediction?.bracket?.qf || {},
    sf: prediction?.bracket?.sf || {},
    final: prediction?.bracket?.final || {},
    bronze: prediction?.bracket?.bronze || {}
  };
}

function PredictionCompact({ prediction, mode, mainTab, advancedTab, onMainTabChange, onAdvancedTabChange }) {
  if (!prediction) return null;

  const simplePrediction = getSimplePrediction(mode, prediction);
  const hasAdvanced = mode !== 'simple';

  if (!hasAdvanced || mainTab === 'simple') {
    return (
      <div className="pred-compact">
        {hasAdvanced && (
          <div className="pred-tabs">
            <button type="button" className={`pred-tab-btn ${mainTab === 'simple' ? 'active' : ''}`} onClick={onMainTabChange('simple')}>
              ⚡ Simpel
            </button>
            <button type="button" className={`pred-tab-btn ${mainTab === 'advanced' ? 'active' : ''}`} onClick={onMainTabChange('advanced')}>
              ⭐ Avanceret
            </button>
          </div>
        )}
        <div className="pred-compact-title">⚡ Simpel forudsigelse</div>
        <div className="pred-grid">
          {SIMPLE_FIELDS.map(f => (
            <div key={f.key} className="pred-item">
              <div className="pred-item-label">{f.label}</div>
              <div className="pred-item-value">{compactList(simplePrediction?.[f.key])}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const g = prediction?.g || {};
  const bracket = prediction?.bracket || {};
  const fun = prediction?.fun || {};
  const funAnswered = FUN_QUESTIONS.filter(q => isFilled(fun[q.id])).length;
  const groupKeys = Object.keys(GROUPS);
  const thirdSelected = new Set(prediction?.third || []);
  const bracketState = predictionToBracketState(prediction);
  const funRows = FUN_QUESTIONS.map(q => ({
    id: q.id,
    label: q.title.replace(/^\S+\s*/, ''),
    value: compactList(fun?.[q.id])
  }));

  return (
    <div className="pred-compact">
      <div className="pred-tabs">
        <button type="button" className={`pred-tab-btn ${mainTab === 'simple' ? 'active' : ''}`} onClick={onMainTabChange('simple')}>
          ⚡ Simpel
        </button>
        <button type="button" className={`pred-tab-btn ${mainTab === 'advanced' ? 'active' : ''}`} onClick={onMainTabChange('advanced')}>
          ⭐ Avanceret
        </button>
      </div>

      <div className="pred-compact-title">⭐ Fodboldinteresseret forudsigelse</div>
      <div className="pred-subtabs">
        <button type="button" className={`pred-subtab-btn ${advancedTab === 'groups' ? 'active' : ''}`} onClick={onAdvancedTabChange('groups')}>
          Grupper + 3'ere
        </button>
        <button type="button" className={`pred-subtab-btn ${advancedTab === 'bracket' ? 'active' : ''}`} onClick={onAdvancedTabChange('bracket')}>
          Bracket
        </button>
        <button type="button" className={`pred-subtab-btn ${advancedTab === 'fun' ? 'active' : ''}`} onClick={onAdvancedTabChange('fun')}>
          Sjove tips
        </button>
      </div>

      {advancedTab === 'groups' && (
        <>
          <div className="pred-grid pred-grid-wide">
            <div className="pred-item">
              <div className="pred-item-label">Topplaceringer</div>
              <div className="pred-item-value">
                Mester: {compactList(bracket?.final?.fin)} | Bronze: {compactList(bracket?.bronze?.bronze_w)}
              </div>
            </div>
            <div className="pred-item">
              <div className="pred-item-label">Bedste 3'ere</div>
              <div className="pred-item-value">{compactList(prediction?.third)}</div>
            </div>
          </div>

          <div className="pred-group-grid">
            {groupKeys.map(key => {
              const group = g[key] || {};
              const teams = groupTeamsWithPlacement(key, group);
              return (
                <div key={key} className="pred-group-card">
                  <div className="pred-group-title">{key}</div>
                  {teams.length === 0 && <div className="pred-group-line">-</div>}
                  {teams.map((teamName, idx) => {
                    const place = idx + 1;
                    const isThirdPick = place === 3 && thirdSelected.has(key);
                    const isDirect = place <= 2;
                    const cls = 'pred-group-line' + (isDirect ? ' is-direct' : '') + (isThirdPick ? ' is-third-pick' : '');
                    return (
                      <div key={`${key}-${teamName}-${place}`} className={cls}>
                        {place}) {teamName}
                        {isDirect && <span className="pred-team-tag">Videre</span>}
                        {isThirdPick && <span className="pred-team-tag pred-team-tag-third">3'er valgt</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="pred-selected-third">
            <div className="pred-item-label">Valgte 8 bedste 3'ere</div>
            <div className="pred-third-chip-wrap">
              {(prediction?.third || []).map(groupKey => (
                <span key={`third-${groupKey}`} className="pred-third-chip">{groupKey}</span>
              ))}
              {(prediction?.third || []).length === 0 && <span className="pred-third-chip pred-third-chip-empty">Ingen valgt</span>}
            </div>
          </div>
        </>
      )}

      {advancedTab === 'bracket' && (
        <>
          <div className="pred-section-title">Hele bracket'en</div>
          <div className="pred-bracket-live">
            <BracketTab
              S={bracketState}
              onPick={null}
              showHeader={false}
              notReadyMessage="Denne forudsigelse mangler data for at vise hele bracket'en."
              readOnly={true}
            />
          </div>
        </>
      )}

      {advancedTab === 'fun' && (
        <>
          <div className="pred-section-title">Sjove forudsigelser ({funAnswered}/{FUN_QUESTIONS.length})</div>
          <div className="pred-grid pred-grid-wide">
            {funRows.map(row => (
              <div key={row.id} className="pred-item">
                <div className="pred-item-label">{row.label}</div>
                <div className="pred-item-value">{row.value}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ScoreRow({ colleague, AR, rank, isOwn, showPrediction, leaderboardView }) {
  const [open, setOpen] = useState(false);
  const [mainTab, setMainTab] = useState('simple');
  const [advancedTab, setAdvancedTab] = useState('groups');
  const { name, mode, prediction } = colleague;
  const isSimple = mode === 'simple';
  const simplePrediction = getSimplePrediction(mode, prediction);

  let pts = 0, breakdown = [];
  if (AR && Object.keys(AR).length > 0 && prediction) {
    if (leaderboardView === 'simple') {
      ({ pts, breakdown } = calcSimpleScore(simplePrediction, AR));
    } else if (leaderboardView === 'advanced') {
      if (!isSimple) {
        ({ pts, breakdown } = calcScore(prediction.g, prediction.bracket, prediction.fun, AR));
      }
    } else if (isSimple) {
      ({ pts, breakdown } = calcSimpleScore(prediction, AR));
    } else {
      ({ pts, breakdown } = calcScore(prediction.g, prediction.bracket, prediction.fun, AR));
    }
  }

  const medals = ['🥇','🥈','🥉'];

  return (
    <div
      className={'lb-row' + (rank <= 3 ? ' lb-top' : '') + (isOwn ? ' lb-own' : '')}
      onClick={() => setOpen(!open)}
    >
      <span className="lb-rank">{medals[rank-1] || rank}</span>
      <span className="lb-name">{name}{isOwn ? ' 👤' : ''}</span>
      <span className="lb-mode">{isSimple ? '⚡' : '⭐'}</span>
      <span className="lb-pts">{AR && Object.keys(AR).length > 0 ? pts + ' pt' : '–'}</span>
      {open && breakdown.length > 0 && (
        <div className="lb-breakdown" onClick={e => e.stopPropagation()}>
          {breakdown.map((b, i) => <div key={i} className="bd-item">{b}</div>)}
        </div>
      )}
      {open && showPrediction && prediction && (
        <div className="lb-prediction" onClick={e => e.stopPropagation()}>
          <PredictionCompact
            prediction={prediction}
            mode={mode}
            mainTab={mainTab}
            advancedTab={advancedTab}
            onMainTabChange={(tab) => (event) => {
              event.stopPropagation();
              setMainTab(tab);
            }}
            onAdvancedTabChange={(tab) => (event) => {
              event.stopPropagation();
              setAdvancedTab(tab);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function KonkurrenceTab({
  S,
  FUN,
  SIMPLE,
  serverData,
  onSubmit,
  loading,
  onReset,
  myName,
  setMyName,
  myEditCode,
  setMyEditCode,
  onLoadMine,
  adminVerify,
  adminLogout,
  isAdmin
}) {
  const [name, setName] = useState(myName || '');
  const [editCode, setEditCode] = useState(myEditCode || '');
  const [newEditCode, setNewEditCode] = useState('');
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('advanced');
  const [adminPw, setAdminPw] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [leaderboardView, setLeaderboardView] = useState('all');
  const countdown = useCountdown(REVEAL_DATE.getTime());

  const colleagues = serverData?.colleagues || [];
  const AR = serverData?.results || {};
  const revealed = serverData?.revealed ?? (Date.now() >= REVEAL_DATE.getTime());
  const adminPreviewOpen = isAdmin && Date.now() < ADMIN_PREVIEW_UNTIL.getTime();
  const canSeePredictions = revealed || isAdmin;
  const registrationClosed = revealed;
  const simpleMissing = getSimpleMissing(SIMPLE);
  const advancedMissing = getAdvancedMissing(S, FUN);
  const modeComplete = mode === 'simple' ? simpleMissing.length === 0 : advancedMissing.length === 0;
  const canSubmit = !registrationClosed && !loading;

  const handleAdminLogin = async () => {
    if (!adminPw.trim()) {
      setAdminStatus('❌ Indtast admin-adgangskode');
      return;
    }
    const res = await adminVerify(adminPw);
    if (res.ok) {
      setAdminStatus('✅ Admin login aktiv');
      return;
    }
    setAdminStatus('❌ ' + res.error);
  };

  const handleAdminLogout = () => {
    adminLogout();
    setAdminPw('');
    setAdminStatus('');
  };

  const handleLoadMine = async () => {
    if (!name.trim()) {
      setStatus('Skriv dit navn!');
      return;
    }
    if (!editCode.trim()) {
      setStatus('Skriv din redigeringskode!');
      return;
    }
    const res = await onLoadMine(name.trim(), editCode.trim());
    if (res.ok) {
      setStatus('✅ Din forudsigelse er hentet.');
      return;
    }
    setStatus('❌ ' + res.error);
  };

  const handleSubmit = async () => {
    if (registrationClosed) { setStatus('⛔ Tilmelding er lukket. VM er startet.'); return; }
    if (!name.trim()) { setStatus('Skriv dit navn!'); return; }
    if (!modeComplete && !isAdmin) {
      setStatus(mode === 'simple'
        ? `⚠️ Mangler i Hurtig mode: ${simpleMissing.join(', ')}`
        : `⚠️ Mangler i Fodboldinteresseret mode: ${advancedMissing.join(' | ')}`);
      return;
    }
    const prediction = mode === 'simple'
      ? SIMPLE
      : { g: S.g, third: S.third, bracket: { r32: S.r32, r16: S.r16, qf: S.qf, sf: S.sf, final: S.final, bronze: S.bronze }, fun: FUN };
    const res = await onSubmit(name.trim(), mode, prediction, editCode.trim(), isAdmin ? adminPw.trim() : '', newEditCode.trim());
    if (res.ok) {
      setMyName(name.trim());
      if (res.editCode) {
        setEditCode(res.editCode);
        setMyEditCode(res.editCode);
      }
      setNewEditCode('');
      if (res.codeChanged && res.editCode) {
        setStatus(`✅ Gemt! Din redigeringskode er nu: ${res.editCode}.`);
      } else if (res.codeGenerated && res.editCode) {
        setStatus(`✅ Gemt! Din redigeringskode er: ${res.editCode}. Gem den, hvis du vil rette senere.`);
      } else {
        setStatus('✅ Gemt!');
      }
    } else {
      setStatus('❌ ' + res.error);
    }
  };

  const hasResults = AR && Object.keys(AR).length > 0;
  const filteredColleagues = useMemo(() => {
    let list = [...colleagues];

    if (leaderboardView === 'advanced') {
      list = list.filter(c => c.mode !== 'simple');
    }

    if (!(hasResults && canSeePredictions)) {
      return list;
    }

    const scoreOf = (c) => {
      if (!c.prediction) return 0;

      if (leaderboardView === 'simple') {
        const simplePrediction = getSimplePrediction(c.mode, c.prediction);
        return calcSimpleScore(simplePrediction, AR).pts;
      }

      if (leaderboardView === 'advanced') {
        if (c.mode === 'simple') return -1;
        return calcScore(c.prediction?.g, c.prediction?.bracket, c.prediction?.fun, AR).pts;
      }

      if (c.mode === 'simple') return calcSimpleScore(c.prediction, AR).pts;
      return calcScore(c.prediction?.g, c.prediction?.bracket, c.prediction?.fun, AR).pts;
    };

    return list.sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [AR, canSeePredictions, colleagues, hasResults, leaderboardView]);

  const advancedCount = colleagues.filter(c => c.mode !== 'simple').length;
  const simpleCount = colleagues.length;

  const countdownStr = formatCountdown(countdown);

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>📊 Stilling &amp; Indsend</h2>
      </div>

      {/* Countdown / reveal banner */}
      {!revealed && countdownStr && (
        <div className="reveal-banner">
          <div className="reveal-icon">🔒</div>
          <div>
            <strong>Forudsigelserne afsløres når VM starter</strong>
            <div className="reveal-date">1. juni 2026 kl. 21:00 dansk tid</div>
            <div className="reveal-countdown">{countdownStr}</div>
          </div>
        </div>
      )}

      <div className="section-card">
        <h3>📤 Send din forudsigelse</h3>
        <div className="submit-panel">
          <div className="submit-panel-grid">
            <div className="submit-panel-block">
              <div className="submit-panel-label">Bruger</div>
              <input
                type="text"
                className="name-input submit-input"
                placeholder="Dit navn"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <select value={mode} onChange={e => setMode(e.target.value)} className="mode-select submit-input">
                <option value="advanced">⭐ Fodboldinteresseret</option>
                <option value="simple">⚡ Hurtig</option>
              </select>
            </div>

            <div className="submit-panel-block">
              <div className="submit-panel-label">Login og kode</div>
              <input
                type="text"
                className="name-input submit-input"
                placeholder="Redigeringskode"
                value={editCode}
                onChange={e => setEditCode(e.target.value.toUpperCase())}
              />
              <input
                type="text"
                className="name-input submit-input"
                placeholder="Ny redigeringskode (valgfri)"
                value={newEditCode}
                onChange={e => setNewEditCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="submit-action-row">
            <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
              {loading ? 'Sender…' : registrationClosed ? 'Tilmelding lukket' : 'Send ✈️'}
            </button>
            <button className="btn-accent btn-sm" onClick={handleLoadMine} disabled={loading}>🔐 Log ind og hent</button>
            <button className="btn-ghost btn-sm" onClick={onReset}>🗑️ Nulstil</button>
          </div>

          <div className="submit-meta-list">
            {registrationClosed && <p className="info-txt">⛔ Tilmelding er lukket fra 1. juni 2026 kl. 21:00 dansk tid.</p>}
            <p className="info-txt">Startkode er 123456 for alle. Du kan senere ændre den ved at udfylde Ny redigeringskode.</p>
            {!registrationClosed && !modeComplete && (
              <p className="info-txt">
                {mode === 'simple'
                  ? `Manglende felter: ${simpleMissing.join(', ')}.`
                  : `Manglende felter: ${advancedMissing.join(' | ')}.`}
              </p>
            )}
            {!registrationClosed && isAdmin && !modeComplete && (
              <p className="info-txt">🔓 Admin kan indsende selvom ikke alle felter er udfyldt.</p>
            )}
          </div>

          {status && <p className={`status-msg${status.startsWith('❌') ? ' error' : ''}`}>{status}</p>}
        </div>
      </div>

      <div className="section-card">
        <h3>🔐 Admin-visning</h3>
        <div className="admin-auth">
          <input
            type="password"
            className="name-input"
            placeholder="Admin-adgangskode"
            value={adminPw}
            onChange={e => setAdminPw(e.target.value)}
          />
          {!isAdmin ? (
            <button className="btn-accent btn-sm" onClick={handleAdminLogin} disabled={loading}>Log ind</button>
          ) : (
            <button className="btn-ghost btn-sm" onClick={handleAdminLogout} disabled={loading}>Log ud</button>
          )}
        </div>
        {!isAdmin && <p className="info-txt">Log ind som admin for at se alles forudsigelser før reveal.</p>}
        {isAdmin && adminPreviewOpen && (
          <p className="info-txt">✅ Som admin ser du den komprimerede visning af alles forudsigelser før 11. juni kl. 21:00.</p>
        )}
        {adminStatus && <p className="status-msg">{adminStatus}</p>}
      </div>

      <div className="section-card">
        <h3>🏆 {(revealed || isAdmin) ? 'Stilling' : 'Deltagere'} ({colleagues.length})</h3>

        <div className="lb-view-switch">
          <button
            className={`lb-view-btn ${leaderboardView === 'all' ? 'active' : ''}`}
            onClick={() => setLeaderboardView('all')}
            type="button"
          >
            Samlet ({colleagues.length})
          </button>
          <button
            className={`lb-view-btn ${leaderboardView === 'advanced' ? 'active' : ''}`}
            onClick={() => setLeaderboardView('advanced')}
            type="button"
          >
            ⭐ Avanceret ({advancedCount})
          </button>
          <button
            className={`lb-view-btn ${leaderboardView === 'simple' ? 'active' : ''}`}
            onClick={() => setLeaderboardView('simple')}
            type="button"
          >
            ⚡ Simpel konkurrence ({simpleCount})
          </button>
        </div>

        {!revealed && !isAdmin && (
          <p className="info-txt" style={{marginBottom:12}}>
            👤 Du kan kun se din egen forudsigelse indtil reveal. Alle forudsigelser afsløres 1. juni kl. 21:00.
          </p>
        )}

        {!hasResults && revealed && (
          <p className="info-txt">Stillingen beregnes når resultaterne er indtastet under ✅ Resultater.</p>
        )}

        <div className="lb-list">
          {filteredColleagues.map((c, i) => {
            const isOwn = myName && c.name.toLowerCase() === myName.toLowerCase();
            if (!revealed && !isAdmin && !isOwn) {
              // Show name + mode + submitted, but no prediction/score
              return (
                <div key={c.name} className="lb-row lb-locked">
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-name">{c.name}</span>
                  <span className="lb-mode">{c.mode === 'simple' ? '⚡' : '⭐'}</span>
                  <span className="lb-pts lb-locked-pts">🔒</span>
                </div>
              );
            }
            return (
              <ScoreRow
                key={c.name}
                colleague={c}
                AR={canSeePredictions ? AR : {}}
                rank={i + 1}
                isOwn={!!isOwn}
                showPrediction={canSeePredictions}
                leaderboardView={leaderboardView}
              />
            );
          })}
          {filteredColleagues.length === 0 && <p className="info-txt">Ingen forudsigelser i denne visning endnu.</p>}
        </div>
      </div>
    </div>
  );
}
