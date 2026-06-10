import { useState, useCallback, useEffect, useRef } from 'react';
import useLocalState from './hooks/useLocalState.js';
import useServerData from './hooks/useServerData.js';

const VM_KICKOFF = new Date('2026-06-11T19:00:00Z'); // 11. juni 2026 kl. 21:00 CEST

function useCountdownStr(target) {
  const [diff, setDiff] = useState(() => target - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${String(h).padStart(2,'0')}t ${String(m).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`;
}
import ModeSelector from './components/ModeSelector.jsx';
import ModeIntro from './components/ModeIntro.jsx';
import SimpleMode from './components/SimpleMode.jsx';
import AdvancedMode from './components/AdvancedMode.jsx';
import WinnerBanner from './components/WinnerBanner.jsx';
import { extractSimpleFromAdvanced } from './lib/scoring.js';
import { FUN_QUESTIONS, GROUPS, QF_PAIRS, R16_PAIRS, R32, SF_PAIRS } from './data/wc2026.js';

const GROUP_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SIMPLE_TOP4_KEYS = ['top1', 'top2', 'top3', 'top4'];
const SHARED_FUN_KEYS = ['topscorer', 'golden_ball', 'most_yellow', 'most_goals_team'];
const DEFAULT_EDIT_CODE = '123456';

function isFilled(v) {
  if (typeof v === 'string') return v.trim().length > 0;
  return v !== null && v !== undefined;
}

export default function App() {
  const local = useLocalState();
  const server = useServerData();
  const countdownStr = useCountdownStr(VM_KICKOFF.getTime());
  const [showWarn, setShowWarn] = useState(false);
  const [pendingSimpleChange, setPendingSimpleChange] = useState(null);
  const [showModeIntro, setShowModeIntro] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authCode, setAuthCode] = useState(DEFAULT_EDIT_CODE);
  const [authStatus, setAuthStatus] = useState('');
  const autosaveTimerRef = useRef(null);
  const autosaveSnapshotRef = useRef('');

  const { mode, setMode, S, FUN, SIMPLE, myName, setMyName, updateGroup, setThird, updateBracketRound,
      updateFun, updateSimple, resetAll, loadFromObject,
      setS, setFUN, setSIMPLE, myEditCode, setMyEditCode } = local;

  const simpleComplete = [...SIMPLE_TOP4_KEYS, ...SHARED_FUN_KEYS].every((key) => isFilled(SIMPLE?.[key]));
  const advancedComplete =
    Object.keys(GROUPS).every((k) => {
      const g = S?.g?.[k] || {};
      return isFilled(g.p1) && isFilled(g.p2) && isFilled(g.p3);
    }) &&
    (Array.isArray(S?.third) ? S.third.length === 8 : false) &&
    R32.every((m) => isFilled(S?.r32?.[m.id])) &&
    R16_PAIRS.every((_, i) => isFilled(S?.r16?.[`r16_${i}`])) &&
    QF_PAIRS.every((_, i) => isFilled(S?.qf?.[`qf_${i}`])) &&
    SF_PAIRS.every((_, i) => isFilled(S?.sf?.[`sf_${i}`])) &&
    isFilled(S?.final?.fin) &&
    isFilled(S?.bronze?.bronze_w) &&
    FUN_QUESTIONS.every((q) => isFilled(FUN?.[q.id]));

  const shouldWarnOnClose = !!mode && (mode === 'simple' ? !simpleComplete : !advancedComplete);

  useEffect(() => {
    if (!shouldWarnOnClose) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldWarnOnClose]);

  useEffect(() => {
    setAuthName(myName || '');
  }, [myName]);

  useEffect(() => {
    setAuthCode(myEditCode || DEFAULT_EDIT_CODE);
  }, [myEditCode]);

  // Sync bracket → simple
  const syncBracketToSimple = useCallback((newS) => {
    const derived = extractSimpleFromAdvanced(newS, FUN);
    setSIMPLE(prev => ({ ...prev, ...derived }));
  }, [FUN, setSIMPLE]);

  // When bracket round changes, update S and sync simple
  const handleBracketPick = useCallback((round, id, team) => {
    setS(prev => {
      const store = prev[round] || {};
      const newStore = store[id] === team
        ? (({ [id]: _, ...rest }) => rest)(store)
        : { ...store, [id]: team };
      const newS = { ...prev, [round]: newStore };
      if (['qf','sf','final','bronze'].includes(round)) {
        setTimeout(() => syncBracketToSimple(newS), 0);
      }
      return newS;
    });
  }, [setS, syncBracketToSimple]);

  // Sync simple top4 → bracket (warn if advanced filled)
  const handleSimpleChange = useCallback((field, value) => {
    const hasAdvanced = Object.values(S.sf || {}).some(Boolean) || Object.values(S.final || {}).some(Boolean);
    if (hasAdvanced && ['top1','top2','top3','top4'].includes(field)) {
      setPendingSimpleChange({ field, value });
      setShowWarn(true);
      return;
    }
    updateSimple(field, value);
  }, [S, updateSimple]);

  const confirmSimpleChange = useCallback(() => {
    if (pendingSimpleChange) {
      updateSimple(pendingSimpleChange.field, pendingSimpleChange.value);
      // Clear bracket sync fields
      setS(prev => ({ ...prev, sf: {}, final: {}, bronze: {} }));
    }
    setShowWarn(false);
    setPendingSimpleChange(null);
  }, [pendingSimpleChange, updateSimple, setS]);

  const resetGroupsOnly = useCallback(() => {
    setS(prev => ({
      ...prev,
      g: {},
      third: [],
      r32: {},
      r16: {},
      qf: {},
      sf: {},
      final: {},
      bronze: {}
    }));
    SIMPLE_TOP4_KEYS.forEach(k => updateSimple(k, null));
  }, [setS, updateSimple]);

  const resetThirdOnly = useCallback(() => {
    setS(prev => ({
      ...prev,
      third: [],
      r32: {},
      r16: {},
      qf: {},
      sf: {},
      final: {},
      bronze: {}
    }));
    SIMPLE_TOP4_KEYS.forEach(k => updateSimple(k, null));
  }, [setS, updateSimple]);

  const resetBracketOnly = useCallback(() => {
    setS(prev => {
      const next = {
        ...prev,
        r32: {},
        r16: {},
        qf: {},
        sf: {},
        final: {},
        bronze: {}
      };
      setTimeout(() => syncBracketToSimple(next), 0);
      return next;
    });
  }, [setS, syncBracketToSimple]);

  const resetFunOnly = useCallback(() => {
    SHARED_FUN_KEYS.forEach(k => updateSimple(k, null));
    setFUN(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[k] = null;
      });
      return next;
    });
  }, [setFUN, updateSimple]);

  const resetSimpleTop4Only = useCallback(() => {
    SIMPLE_TOP4_KEYS.forEach(k => updateSimple(k, null));
  }, [updateSimple]);

  const resetSimpleFunOnly = useCallback(() => {
    SHARED_FUN_KEYS.forEach(k => updateSimple(k, null));
  }, [updateSimple]);

  const loadMyPrediction = useCallback(async (name, editCode) => {
    const res = await server.fetchMyPrediction(name, editCode);
    if (!res.ok) return res;

    const entry = res.entry;
    if (!entry || !entry.mode || !entry.prediction) {
      return { ok: false, error: 'Kunne ikke laese forudsigelsen fra serveren' };
    }

    if (entry.mode === 'simple') {
      loadFromObject({
        mode: 'simple',
        SIMPLE: entry.prediction
      });
    } else {
      const bracket = entry.prediction?.bracket || {};
      const nextS = {
        g: entry.prediction?.g || {},
        third: entry.prediction?.third || [],
        r32: bracket.r32 || {},
        r16: bracket.r16 || {},
        qf: bracket.qf || {},
        sf: bracket.sf || {},
        final: bracket.final || {},
        bronze: bracket.bronze || {}
      };
      const nextFUN = entry.prediction?.fun || {};
      loadFromObject({
        mode: 'advanced',
        S: nextS,
        FUN: nextFUN,
        SIMPLE: extractSimpleFromAdvanced(nextS, nextFUN)
      });
    }

    setMyName(entry.name || name.trim());
    setMyEditCode(editCode.trim().toUpperCase());
    setIsAuthenticated(true);
    return { ok: true, mode: entry.mode };
  }, [loadFromObject, server, setMyName, setMyEditCode]);

  const handleInitialLogin = useCallback(async () => {
    const name = authName.trim();
    const code = (authCode || DEFAULT_EDIT_CODE).trim().toUpperCase();
    if (!name) {
      setAuthStatus('❌ Skriv dit navn');
      return;
    }

    const res = await loadMyPrediction(name, code);
    if (res.ok) {
      setAuthStatus('✅ Logget ind og tidligere bud hentet');
      return;
    }

    if (res.error?.includes('Ingen forudsigelse fundet')) {
      setMyName(name);
      setMyEditCode(code);
      resetAll();
      setMode(null);
      setShowModeIntro(false);
      setIsAuthenticated(true);
      setAuthStatus('✅ Ny bruger oprettet. Vælg mode og lav dit bud.');
      return;
    }

    setAuthStatus('❌ ' + res.error);
  }, [authName, authCode, loadMyPrediction, resetAll, setMode, setMyEditCode, setMyName]);

  const handleSwitchUser = useCallback(() => {
    setIsAuthenticated(false);
    setShowModeIntro(false);
    setMode(null);
    setAuthStatus('');
    setAuthName('');
    setAuthCode(DEFAULT_EDIT_CODE);
  }, [setMode]);

  useEffect(() => {
    if (!isAuthenticated || server.isAdmin || !mode || !myName?.trim()) return;

    const code = (myEditCode || '123456').trim().toUpperCase();
    const prediction = mode === 'simple'
      ? SIMPLE
      : {
          g: S.g,
          third: S.third,
          bracket: {
            r32: S.r32,
            r16: S.r16,
            qf: S.qf,
            sf: S.sf,
            final: S.final,
            bronze: S.bronze
          },
          fun: FUN
        };

    const snapshot = JSON.stringify({ name: myName.trim(), mode, code, prediction, isAdmin: server.isAdmin });
    if (snapshot === autosaveSnapshotRef.current) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      const res = await server.autosavePrediction(
        myName.trim(),
        mode,
        prediction,
        code,
        server.isAdmin ? server.adminPassword : ''
      );
      if (res.ok) {
        autosaveSnapshotRef.current = snapshot;
        if (res.editCode && res.editCode !== myEditCode) {
          setMyEditCode(res.editCode);
        }
      }
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [
    isAuthenticated,
    mode,
    S,
    FUN,
    SIMPLE,
    myName,
    myEditCode,
    server.isAdmin,
    server.adminPassword,
    server.autosavePrediction,
    setMyEditCode
  ]);

  if (!isAuthenticated) {
    return (
      <div className="app-root login-gate-wrap">
        <div className="section-card login-gate-card">
          <h2>🔐 Log ind for at starte</h2>
          <p className="info-txt">Indtast navn og kode. Hvis du allerede har givet et bud, er din kode 123456 (medmindre du selv har ændret den).</p>
          <div className="submit-panel">
            <div className="submit-panel-grid single-column-submit">
              <div className="submit-panel-block">
                <div className="submit-panel-label">Login</div>
                <input
                  type="text"
                  className="name-input submit-input"
                  placeholder="Dit navn"
                  value={authName}
                  onChange={e => setAuthName(e.target.value)}
                />
                <input
                  type="text"
                  className="name-input submit-input"
                  placeholder="Kode"
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="submit-action-row">
              <button className="btn-primary" onClick={handleInitialLogin} disabled={server.loading}>Log ind</button>
            </div>
            <div className="submit-meta-list">
              <p className="info-txt">Findes dit bud ikke endnu, bliver du oprettet som ny bruger og kan lave et nyt bud.</p>
            </div>
            {authStatus && <p className={`status-msg${authStatus.startsWith('❌') ? ' error' : ''}`}>{authStatus}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!mode) {
    return <ModeSelector onSelect={(m) => { setMode(m); setShowModeIntro(true); }} />;
  }

  if (showModeIntro) {
    return (
      <ModeIntro
        mode={mode}
        onStart={() => setShowModeIntro(false)}
        onBack={() => setMode(null)}
      />
    );
  }

  const champ = S.final?.['fin'] || SIMPLE?.top1 || null;

  return (
    <div className="app-root">
      <header className="app-header">
        <span className="app-logo">⚽</span>
        <h1>VM 2026 – PrivatTribeDK</h1>
        {countdownStr && (
          <div className="app-countdown">
            <span className="app-countdown-label">⏳ VM starter om:</span>
            <span className="app-countdown-timer">{countdownStr}</span>
          </div>
        )}
        <button className="btn-ghost btn-sm" onClick={() => setMode(null)}>
          Skift mode
        </button>
        <button className="btn-ghost btn-sm" onClick={handleSwitchUser}>
          Skift bruger
        </button>
      </header>

      {champ && <WinnerBanner champ={champ} />}

      {showWarn && (
        <div className="modal-overlay" onClick={() => setShowWarn(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>⚠️ Advarsel</h3>
            <p>Du er ved at ændre Hurtig mode. Dette vil nulstille din avancerede bracket (Semifinale, Finale og Bronzekamp).</p>
            <div className="modal-btns">
              <button className="btn-danger" onClick={confirmSimpleChange}>Fortsæt og nulstil bracket</button>
              <button className="btn-ghost" onClick={() => { setShowWarn(false); setPendingSimpleChange(null); }}>Annuller</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'simple' ? (
        <SimpleMode
          SIMPLE={SIMPLE}
          S={S}
          onChange={handleSimpleChange}
          onFunChange={updateFun}
          FUN={FUN}
          serverData={server.serverData}
          onSubmit={server.submitPrediction}
          loading={server.loading}
          onReset={resetAll}
          onResetTop4={resetSimpleTop4Only}
          onResetFun={resetSimpleFunOnly}
          myName={myName}
          setMyName={setMyName}
          myEditCode={myEditCode}
          setMyEditCode={setMyEditCode}
          onLoadMine={loadMyPrediction}
        />
      ) : (
        <AdvancedMode
          S={S}
          FUN={FUN}
          SIMPLE={SIMPLE}
          updateGroup={updateGroup}
          setThird={setThird}
          onBracketPick={handleBracketPick}
          updateFun={updateFun}
          updateSimple={handleSimpleChange}
          serverData={server.serverData}
          onSubmit={server.submitPrediction}
          adminUpdate={server.adminUpdateResults}
          adminVerify={server.adminVerifyPassword}
          adminLogout={server.adminLogout}
          isAdmin={server.isAdmin}
          adminPassword={server.adminPassword}
          adminDelete={server.adminDeleteOne}
          adminClearAll={server.adminClearAll}
          loading={server.loading}
          fetchData={server.fetchData}
          onReset={resetAll}
          onResetGroups={resetGroupsOnly}
          onResetThird={resetThirdOnly}
          onResetBracket={resetBracketOnly}
          onResetFun={resetFunOnly}
          setS={setS}
          setFUN={setFUN}
          setSIMPLE={setSIMPLE}
          myName={myName}
          setMyName={setMyName}
          myEditCode={myEditCode}
          setMyEditCode={setMyEditCode}
          onLoadMine={loadMyPrediction}
        />
      )}
    </div>
  );
}
