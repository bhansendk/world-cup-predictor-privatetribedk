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

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function findSimilarName(inputName, existingNames) {
  const normalized = normalizeName(inputName);
  for (const existing of existingNames) {
    const normExisting = normalizeName(existing);
    if (normExisting === normalized) return null; // exact match, no warning
    const maxLen = Math.max(normalized.length, normExisting.length);
    const threshold = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
    if (levenshtein(normalized, normExisting) <= threshold) return existing;
  }
  return null;
}
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
  const [authWarn, setAuthWarn] = useState('');
  const [pendingLoginArgs, setPendingLoginArgs] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveStatusTimerRef = useRef(null);
  const autosaveSnapshotRef = useRef('');

  const { mode, setMode, S, FUN, SIMPLE, myName, setMyName, updateGroup, setThird,
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

  const shouldWarnOnClose = !!mode && hasUnsavedChanges;

  const buildCurrentPrediction = useCallback(() => {
    if (mode === 'simple') return SIMPLE;
    return {
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
  }, [mode, SIMPLE, S, FUN]);

  const buildSnapshot = useCallback(() => {
    if (!myName?.trim() || !mode) return '';
    const code = (myEditCode || '123456').trim().toUpperCase();
    return JSON.stringify({
      name: myName.trim(),
      mode,
      code,
      prediction: buildCurrentPrediction(),
      isAdmin: server.isAdmin
    });
  }, [myName, mode, myEditCode, buildCurrentPrediction, server.isAdmin]);

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
    const loadedPrediction = entry.mode === 'simple'
      ? entry.prediction
      : {
          g: entry.prediction?.g || {},
          third: entry.prediction?.third || [],
          bracket: entry.prediction?.bracket || {},
          fun: entry.prediction?.fun || {}
        };
    autosaveSnapshotRef.current = JSON.stringify({
      name: entry.name || name.trim(),
      mode: entry.mode,
      code: editCode.trim().toUpperCase(),
      prediction: loadedPrediction,
      isAdmin: false
    });
    setHasUnsavedChanges(false);
    setSaveStatus('saved');
    return { ok: true, mode: entry.mode };
  }, [loadFromObject, server, setMyName, setMyEditCode]);

  const doLogin = useCallback(async (name, code) => {
    const res = await loadMyPrediction(name, code);
    if (res.ok) {
      setAuthStatus('✅ Logget ind og tidligere bud hentet');
      setAuthWarn('');
      setPendingLoginArgs(null);
      return;
    }

    if (res.error?.includes('Ingen forudsigelse fundet')) {
      setAuthStatus('❌ Ingen forudsigelse fundet for dette navn + kode. Brug "Opret ny bruger" hvis du er ny.');
      setAuthWarn('');
      setPendingLoginArgs(null);
      return;
    }

    setAuthStatus('❌ ' + res.error);
    setAuthWarn('');
    setPendingLoginArgs(null);
  }, [loadMyPrediction]);

  const handleCreateNewUser = useCallback(() => {
    const name = authName.trim();
    const code = (authCode || DEFAULT_EDIT_CODE).trim().toUpperCase();
    if (!name) {
      setAuthStatus('❌ Skriv dit navn');
      return;
    }

    const existingNames = (server.serverData?.colleagues || []).map(c => c.name);
    const exactExists = existingNames.some((n) => normalizeName(n) === normalizeName(name));
    if (exactExists) {
      setAuthStatus('❌ Brugeren findes allerede. Brug Log ind med korrekt kode.');
      return;
    }
    const similar = findSimilarName(name, existingNames);
    if (similar) {
      setAuthStatus(`❌ Navnet ligner eksisterende bruger "${similar}". Brug et unikt navn.`);
      return;
    }

    setMyName(name);
    setMyEditCode(code);
    resetAll();
    setMode(null);
    setShowModeIntro(false);
    setIsAuthenticated(true);
    setAuthWarn('');
    setPendingLoginArgs(null);
    setAuthStatus('✅ Ny bruger oprettet lokalt. Vælg mode og lav dit bud.');
  }, [authName, authCode, resetAll, server.serverData, setMode, setMyEditCode, setMyName]);

  const handleInitialLogin = useCallback(async () => {
    const name = authName.trim();
    const code = (authCode || DEFAULT_EDIT_CODE).trim().toUpperCase();
    if (!name) {
      setAuthStatus('❌ Skriv dit navn');
      return;
    }

    // Warn if name looks like the default edit code
    if (normalizeName(name) === '123456') {
      setAuthStatus('');
      setAuthWarn('⚠️ "123456" ser ud som en kode, ikke et navn. Er du sikker på, at du har skrevet dit rigtige navn?');
      setPendingLoginArgs({ name, code });
      return;
    }

    // Warn if name is similar to an existing name
    const existingNames = (server.serverData?.colleagues || []).map(c => c.name);
    const similar = findSimilarName(name, existingNames);
    if (similar) {
      setAuthStatus('');
      setAuthWarn(`⚠️ Der findes allerede en bruger ved navn "${similar}". Mente du det? Klik "Fortsæt alligevel" for at logge ind med "${name}", eller ret dit navn.`);
      setPendingLoginArgs({ name, code });
      return;
    }

    await doLogin(name, code);
  }, [authName, authCode, server.serverData, doLogin]);

  const handleForceLogin = useCallback(async () => {
    if (!pendingLoginArgs) return;
    setAuthWarn('');
    await doLogin(pendingLoginArgs.name, pendingLoginArgs.code);
  }, [pendingLoginArgs, doLogin]);

  const handleSwitchMode = useCallback(() => {
    if (hasUnsavedChanges && !window.confirm('Du har ugemte ændringer. Vil du skifte mode alligevel? Dine ændringer gemmes ikke.')) return;
    setMode(null);
  }, [hasUnsavedChanges, setMode]);

  const handleSwitchUser = useCallback(() => {    setIsAuthenticated(false);
    setShowModeIntro(false);
    setMode(null);
    setAuthStatus('');
    setAuthWarn('');
    setPendingLoginArgs(null);
    setAuthName('');
    setAuthCode(DEFAULT_EDIT_CODE);
    setHasUnsavedChanges(false);
    autosaveSnapshotRef.current = '';
    setSaveStatus('idle');
    clearTimeout(saveStatusTimerRef.current);
  }, [setMode]);

  const handleManualSave = useCallback(async () => {
    if (!myName?.trim() || !mode) return;
    const code = (myEditCode || '123456').trim().toUpperCase();
    const prediction = buildCurrentPrediction();
    setSaveStatus('saving');
    clearTimeout(saveStatusTimerRef.current);
    const res = await server.autosavePrediction(
      myName.trim(),
      mode,
      prediction,
      code,
      server.isAdmin ? server.adminPassword : ''
    );
    if (res.ok) {
      const resolvedCode = res.editCode || code;
      const snapshot = JSON.stringify({ name: myName.trim(), mode, code: resolvedCode, prediction, isAdmin: server.isAdmin });
      autosaveSnapshotRef.current = snapshot;
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 4000);
      if (res.editCode && res.editCode !== myEditCode) {
        setMyEditCode(res.editCode);
      }
    } else {
      setSaveStatus('error');
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 5000);
    }
  }, [myName, mode, myEditCode, buildCurrentPrediction, server, setMyEditCode]);

  useEffect(() => {
    if (!isAuthenticated || server.isAdmin || !mode || !myName?.trim()) return;
    const currentSnapshot = buildSnapshot();
    const dirty = !!currentSnapshot && currentSnapshot !== autosaveSnapshotRef.current;
    setHasUnsavedChanges(dirty);
    if (dirty) setSaveStatus('idle');
  }, [
    isAuthenticated,
    mode,
    S,
    FUN,
    SIMPLE,
    myName,
    myEditCode,
    buildSnapshot,
    server.isAdmin,
  ]);

  useEffect(() => {
    if (isAuthenticated && mode && !server.isAdmin) return;
    setHasUnsavedChanges(false);
    setSaveStatus('idle');
  }, [isAuthenticated, mode, server.isAdmin]);

  if (!isAuthenticated) {
    return (
      <div className="app-root login-gate-wrap">
        <div className="section-card login-gate-card">
          <h2>🔐 Log ind for at starte</h2>
          <p className="info-txt">Indtast navn og kode for at hente dit eksisterende bud. Nye brugere skal vælge "Opret ny bruger".</p>
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
                  onKeyDown={e => e.key === 'Enter' && !server.loading && handleInitialLogin()}
                />
                <input
                  type="text"
                  className="name-input submit-input"
                  placeholder="Kode"
                  value={authCode}
                  onChange={e => setAuthCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && !server.loading && handleInitialLogin()}
                />
              </div>
            </div>
            <div className="submit-action-row">
              <button className="btn-primary" onClick={handleInitialLogin} disabled={server.loading}>Log ind</button>
              <button className="btn-ghost" onClick={handleCreateNewUser} disabled={server.loading}>Opret ny bruger</button>
            </div>
            <div className="submit-meta-list">
              <p className="info-txt">Login henter kun eksisterende bud. Hvis du er ny, brug "Opret ny bruger".</p>
            </div>
            {authWarn && (
              <div className="status-msg warn">
                <p>{authWarn}</p>
                <div className="submit-action-row" style={{ marginTop: '0.5rem' }}>
                  <button className="btn-danger btn-sm" onClick={handleForceLogin} disabled={server.loading}>Fortsæt alligevel</button>
                  <button className="btn-ghost btn-sm" onClick={() => { setAuthWarn(''); setPendingLoginArgs(null); }}>Ret navn</button>
                </div>
              </div>
            )}
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
        {myName && <div className="app-user-indicator">Logget ind som: {myName}</div>}
        {countdownStr && (
          <div className="app-countdown">
            <span className="app-countdown-label">⏳ VM starter om:</span>
            <span className="app-countdown-timer">{countdownStr}</span>
          </div>
        )}
        {isAuthenticated && mode && !server.isAdmin && (
          <button
            className={`btn-sm ${
              saveStatus === 'saving' ? 'btn-ghost' :
              saveStatus === 'saved' ? 'btn-ghost' :
              saveStatus === 'error' ? 'btn-danger' :
              hasUnsavedChanges ? 'btn-primary' : 'btn-ghost'
            }`}
            onClick={handleManualSave}
            disabled={server.loading || saveStatus === 'saving' || (!hasUnsavedChanges && saveStatus !== 'error')}
            title={hasUnsavedChanges ? 'Du har ugemte ændringer' : ''}
          >
            {saveStatus === 'saving' ? 'Gemmer…' :
             saveStatus === 'saved' ? '✓ Gemt' :
             saveStatus === 'error' ? '⚠ Fejl ved gem' :
             hasUnsavedChanges ? '💾 Gem ●' : '💾 Gem'}
          </button>
        )}
        <button className="btn-ghost btn-sm" onClick={handleSwitchMode}>
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
        />
      )}
    </div>
  );
}
