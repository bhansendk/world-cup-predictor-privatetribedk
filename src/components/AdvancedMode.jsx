import { useEffect, useState } from 'react';
import GroupsTab from './tabs/Groups.jsx';
import ThirdTab from './tabs/Third.jsx';
import BracketTab from './tabs/Bracket.jsx';
import FunTipsTab from './tabs/FunTips.jsx';
import KonkurrenceTab from './tabs/Konkurrence.jsx';
import ResultaterTab from './tabs/Resultater.jsx';
import { COMBO } from '../data/combo.js';
import { FUN_QUESTIONS, GROUPS, QF_PAIRS, R16_PAIRS, R32, SF_PAIRS } from '../data/wc2026.js';
import { extractSimpleFromAdvanced, resolveSlot } from '../lib/scoring.js';

const TABS = [
  { id: 'groups',    label: '🏟️ Grupper' },
  { id: 'third',     label: '🥉 3\'ere' },
  { id: 'bracket',   label: '🏆 Bracket' },
  { id: 'fun',       label: '🎯 Sjove tips' },
  { id: 'ranking',   label: '📊 Stilling' },
  { id: 'results',   label: '✅ Resultater' },
];

export default function AdvancedMode(props) {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem('vm2026_active_tab') || 'groups';
    } catch {
      return 'groups';
    }
  });
  const { S, FUN, SIMPLE, updateGroup, setThird, onBracketPick, updateFun, updateSimple,
      serverData, onSubmit, adminUpdate, adminVerify, adminDelete, adminClearAll, loading,
        fetchData, onReset, setS, setFUN, setSIMPLE, myName, setMyName, isAdmin, adminLogout, adminPassword } = props;

  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)] || null;

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const fillAllRandomAdvanced = () => {
    const groupEntries = Object.entries(GROUPS);
    const g = {};

    groupEntries.forEach(([key, group]) => {
      const [p1, p2, p3] = shuffle(group.teams);
      g[key] = { p1: p1 || null, p2: p2 || null, p3: p3 || null };
    });

    const third = shuffle(Object.keys(GROUPS)).slice(0, 8).sort();
    const comboKey = third.join('');
    const comboExists = !!COMBO[comboKey];
    if (!comboExists) {
      // Extremely unlikely fallback: keep trying until a valid combo appears.
      for (let i = 0; i < 50; i += 1) {
        const retry = shuffle(Object.keys(GROUPS)).slice(0, 8).sort();
        if (COMBO[retry.join('')]) {
          third.splice(0, third.length, ...retry);
          break;
        }
      }
    }

    const pickWinner = (a, b) => {
      const teams = [a, b].filter(Boolean);
      return teams.length ? randomPick(teams) : null;
    };

    const r32 = {};
    R32.forEach(m => {
      const a = resolveSlot(m.a, g, third);
      const b = resolveSlot(m.b, g, third);
      r32[m.id] = pickWinner(a, b);
    });

    const r16 = {};
    R16_PAIRS.forEach(([i, j], idx) => {
      const w = pickWinner(r32[R32[i].id], r32[R32[j].id]);
      r16[`r16_${idx}`] = w;
    });

    const qf = {};
    QF_PAIRS.forEach(([i, j], idx) => {
      qf[`qf_${idx}`] = pickWinner(r16[`r16_${i}`], r16[`r16_${j}`]);
    });

    const sf = {};
    SF_PAIRS.forEach(([i, j], idx) => {
      sf[`sf_${idx}`] = pickWinner(qf[`qf_${i}`], qf[`qf_${j}`]);
    });

    const final = { fin: pickWinner(sf.sf_0, sf.sf_1) };
    const sfLoser0 = sf.sf_0 ? (qf.qf_0 === sf.sf_0 ? qf.qf_1 : qf.qf_0) : null;
    const sfLoser1 = sf.sf_1 ? (qf.qf_2 === sf.sf_1 ? qf.qf_3 : qf.qf_2) : null;
    const bronze = { bronze_w: pickWinner(sfLoser0, sfLoser1) };

    const fun = {};
    FUN_QUESTIONS.forEach(q => {
      fun[q.id] = randomPick(q.options) || null;
    });

    const nextS = { g, third, r32, r16, qf, sf, final, bronze };
    setS(nextS);
    setFUN(fun);
    setSIMPLE(prev => ({ ...prev, ...extractSimpleFromAdvanced(nextS, fun) }));
  };

  useEffect(() => {
    try {
      localStorage.setItem('vm2026_active_tab', tab);
    } catch {}
  }, [tab]);

  return (
    <div className="mode-container">
      <div className="section-card">
        <h2>📘 Pointsystem - Fodboldinteresseret</h2>
        <ul className="points-list">
          <li>Grupper: 1./2./3. plads giver 4/3/2 point, men du mister 1 point pr. forkert placering (kun for hold der går videre)</li>
          <li>8 bedste 3'ere: 2 point pr. korrekt gruppe</li>
          <li>Bracket: point gives for hvor langt et hold kommer (ikke præcis kamp/slot): R16 = 2, KF = 4, SF = 6, Finale = 8</li>
          <li>Finale: korrekt finalist = 6 point pr. hold, mester = 15 point</li>
          <li>Bronzekamp: korrekt vinder = 5 point</li>
          <li>Sjove tips: point gives pr. spørgsmål (inkl. spillerforudsigelser som Topscorer og Gyldne Bold)</li>
        </ul>
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={'tab-btn' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'groups' && (
        <GroupsTab S={S} updateGroup={updateGroup} onRandomFillAll={fillAllRandomAdvanced} onResetAll={onReset} />
      )}
      {tab === 'third' && (
        <ThirdTab S={S} setThird={setThird} />
      )}
      {tab === 'bracket' && (
        <BracketTab S={S} onPick={onBracketPick} SIMPLE={SIMPLE} updateSimple={updateSimple} />
      )}
      {tab === 'fun' && (
        <FunTipsTab FUN={FUN} SIMPLE={SIMPLE} updateFun={updateFun} updateSimple={updateSimple} />
      )}
      {tab === 'ranking' && (
        <KonkurrenceTab
          S={S} FUN={FUN} SIMPLE={SIMPLE}
          serverData={serverData} onSubmit={onSubmit} loading={loading}
          onReset={onReset} myName={myName} setMyName={setMyName}
          adminVerify={adminVerify}
          adminLogout={adminLogout}
          isAdmin={isAdmin}
        />
      )}
      {tab === 'results' && (
        <ResultaterTab
          serverData={serverData}
          adminUpdate={adminUpdate}
          adminVerify={adminVerify}
          adminLogout={adminLogout}
          isAdmin={isAdmin}
          adminPassword={adminPassword}
          adminDelete={adminDelete}
          adminClearAll={adminClearAll}
          loading={loading}
          fetchData={fetchData}
          setS={setS} setFUN={setFUN} setSIMPLE={setSIMPLE}
        />
      )}
    </div>
  );
}
