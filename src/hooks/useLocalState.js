import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'vm2026_tirsdagsklubben';
const LS_MYNAME_KEY = 'vm2026_tirsdagsklubben_myname';
const LS_MYCODE_KEY = 'vm2026_tirsdagsklubben_editcode';

const EMPTY_S = { g: {}, third: [], r32: {}, r16: {}, qf: {}, sf: {}, final: {}, bronze: {} };
const EMPTY_SIMPLE = {
  top1: null,
  top2: null,
  top3: null,
  top4: null,
  topscorer: null,
  golden_ball: null,
  most_yellow: null,
  most_goals_team: null
};

function normalizeS(input) {
  const s = input || {};
  return {
    g: s.g || {},
    third: Array.isArray(s.third) ? s.third : [],
    r32: s.r32 || {},
    r16: s.r16 || {},
    qf: s.qf || {},
    sf: s.sf || {},
    final: s.final || {},
    bronze: s.bronze || {}
  };
}

function normalizeSimple(input) {
  return { ...EMPTY_SIMPLE, ...(input || {}) };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function useLocalState() {
  const [mode, setModeRaw] = useState(() => loadState()?.mode || null);
  const [S, setS] = useState(() => normalizeS(loadState()?.S || EMPTY_S));
  const [FUN, setFUN] = useState(() => loadState()?.FUN || {});
  const [SIMPLE, setSIMPLE] = useState(() => normalizeSimple(loadState()?.SIMPLE));
  const [myName, setMyNameRaw] = useState(() => {
    try {
      return localStorage.getItem(LS_MYNAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [myEditCode, setMyEditCodeRaw] = useState(() => {
    try {
      return localStorage.getItem(LS_MYCODE_KEY) || '';
    } catch {
      return '';
    }
  });

  const setMyName = useCallback((name) => {
    setMyNameRaw(name);
    try {
      localStorage.setItem(LS_MYNAME_KEY, name);
    } catch {}
  }, []);

  const setMyEditCode = useCallback((code) => {
    setMyEditCodeRaw(code);
    try {
      localStorage.setItem(LS_MYCODE_KEY, code);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ mode, S, FUN, SIMPLE }));
    } catch {}
  }, [mode, S, FUN, SIMPLE]);

  const setMode = useCallback((m) => {
    setModeRaw(m);
  }, []);

  const updateGroup = useCallback((grp, field, value) => {
    setS(prev => ({ ...prev, g: { ...prev.g, [grp]: { ...(prev.g[grp] || {}), [field]: value } } }));
  }, []);

  const setThird = useCallback((arr) => {
    setS(prev => ({ ...prev, third: arr }));
  }, []);

  const updateBracketRound = useCallback((round, id, value) => {
    setS(prev => ({ ...prev, [round]: { ...(prev[round] || {}), [id]: value } }));
  }, []);

  const updateFun = useCallback((id, value) => {
    setFUN(prev => ({ ...prev, [id]: value }));
    // sync shared fields to SIMPLE
    if (['topscorer','golden_ball','most_yellow','most_goals_team'].includes(id)) {
      setSIMPLE(prev => ({ ...prev, [id]: value }));
    }
  }, []);

  const updateSimple = useCallback((field, value) => {
    setSIMPLE(prev => ({ ...prev, [field]: value }));
    // sync shared fields to FUN
    if (['topscorer','golden_ball','most_yellow','most_goals_team'].includes(field)) {
      setFUN(prev => ({ ...prev, [field]: value }));
    }
  }, []);

  const resetAll = useCallback(() => {
    setS(EMPTY_S);
    setFUN({});
    setSIMPLE(EMPTY_SIMPLE);
  }, []);

  const loadFromObject = useCallback((obj) => {
    if (obj.S) setS(normalizeS(obj.S));
    if (obj.FUN) setFUN(obj.FUN);
    if (obj.SIMPLE) setSIMPLE(normalizeSimple(obj.SIMPLE));
    if (obj.mode) setModeRaw(obj.mode);
  }, []);

  return {
    mode, setMode,
    S, FUN, SIMPLE,
    myName, setMyName,
    myEditCode, setMyEditCode,
    updateGroup, setThird, updateBracketRound,
    updateFun, updateSimple,
    resetAll, loadFromObject,
    setS, setFUN, setSIMPLE
  };
}
