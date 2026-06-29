import { GROUPS, FUN_PTS } from '../data/wc2026.js';
import { COMBO } from '../data/combo.js';

const GROUP_BASE_POINTS = { 1: 3, 2: 2, 3: 2 };

function _toArray(v) {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function matchesAnswer(predicted, actual) {
  const p = _toArray(predicted);
  const a = _toArray(actual);
  if (!p.length || !a.length) return false;
  return p.some(x => a.includes(x));
}

// ── Resolve bracket slot to team name ────────────────────────────
export function resolveSlot(slot, g, third) {
  const [rank, grp] = slot;
  const gs = g[grp] || {};
  if (rank === '1') return gs.p1 || null;
  if (rank === '2') return gs.p2 || null;
  if (rank === '3c') {
    const key = [...third].sort().join('');
    const combo = COMBO[key];
    if (!combo) return null;
    const fromGroup = combo[grp];
    return (g[fromGroup] || {}).p3 || null;
  }
  return null;
}

// ── Extract simple top4 from advanced bracket ─────────────────────
export function extractSimpleFromAdvanced(bracket, fun) {
  const br = bracket || {};
  const champ    = br.final?.['fin'] || null;
  const sf0      = br.sf?.['sf_0'] || null;
  const sf1      = br.sf?.['sf_1'] || null;
  const runnerUp = sf0 && sf0 !== champ ? sf0 : (sf1 && sf1 !== champ ? sf1 : null);
  const qf0 = br.qf?.['qf_0'] || null, qf1 = br.qf?.['qf_1'] || null;
  const qf2 = br.qf?.['qf_2'] || null, qf3 = br.qf?.['qf_3'] || null;
  const sfLos0 = sf0 ? (qf0 && qf0 !== sf0 ? qf0 : (qf1 && qf1 !== sf0 ? qf1 : null)) : null;
  const sfLos1 = sf1 ? (qf2 && qf2 !== sf1 ? qf2 : (qf3 && qf3 !== sf1 ? qf3 : null)) : null;
  const bronzeW = br.bronze?.['bronze_w'] || null;
  const top3 = bronzeW || sfLos0;
  const top4 = bronzeW ? (sfLos0 === bronzeW ? sfLos1 : sfLos0) : sfLos1;
  const f = fun || {};
  return {
    top1: champ, top2: runnerUp, top3, top4,
    topscorer: f.topscorer || null,
    golden_ball: f.golden_ball || null,
    most_yellow: f.most_yellow || null,
    most_goals_team: f.most_goals_team || null
  };
}

// ── Advanced scoring ──────────────────────────────────────────────
export function calcScore(tips, bracket, fun, AR) {
  let pts = 0, breakdown = [];

  // Group stage
  Object.keys(GROUPS).forEach(k => {
    const t = (tips || {})[k] || {}, a = (AR.g || {})[k] || {};
    const aRanks = { [a.p1]: 1, [a.p2]: 2, [a.p3]: 3 };
    const advThird = (AR.third || []).includes(k);
    let gp = 0;

    [['p1', 1], ['p2', 2], ['p3', 3]].forEach(([slot, predictedRank]) => {
      const team = t[slot];
      const actualRank = aRanks[team];
      if (!team || !actualRank) return;

      const advanced = actualRank <= 2 || (actualRank === 3 && advThird);
      if (!advanced) return;

      const base = GROUP_BASE_POINTS[predictedRank] || 0;
      const penalty = Math.abs(predictedRank - actualRank);
      const score = Math.max(base - penalty, 1); // min. 1 pt for at ramme at holdet går videre

      pts += score;
      gp += score;
    });

    if (gp) breakdown.push('Gruppe ' + k + ': +' + gp);
  });

  if (!bracket) return { pts, breakdown };

  // 3'ere thirds
  const cThird = bracket.third || [];
  const arThird = AR.third || [];
  let tp = 0;
  cThird.forEach(g => { if (arThird.includes(g)) { pts += 2; tp += 2; } });
  if (tp) breakdown.push('3\'ere: +' + tp);

  // Knockout rounds (team progression, not exact bracket slot)
  // Award progression points even if admin has only filled later rounds —
  // a team appearing in a later round counts as having reached earlier rounds.
  const roundOrder = ['r32', 'r16', 'qf', 'sf'];
  // scaled so champion = 25 (previously 15). progression points scaled accordingly
  const roundPoints = { r32: 3, r16: 7, qf: 10, sf: 13 };
  const roundLabels = { r32: 'R16 nået', r16: 'KF nået', qf: 'SF nået', sf: 'Finale nået' };

  for (let i = 0; i < roundOrder.length; i++) {
    const key = roundOrder[i];
    const pStore = bracket?.[key] || {};
    const predictedTeams = new Set(Object.values(pStore).filter(Boolean));
    if (!predictedTeams.size) continue;

    // Build a union of actual teams from this round and any later rounds
    const actualTeams = new Set();
    for (let j = i; j < roundOrder.length; j++) {
      const aStore = AR[roundOrder[j]] || {};
      Object.values(aStore).filter(Boolean).forEach(t => actualTeams.add(t));
    }
    // Also include final/bronce winners if present (they imply progression)
    if (AR.final) Object.values(AR.final).filter(Boolean).forEach(t => actualTeams.add(t));
    if (AR.bronze) Object.values(AR.bronze).filter(Boolean).forEach(t => actualTeams.add(t));

    let rp = 0;
    const rPts = roundPoints[key] || 0;
    predictedTeams.forEach(team => {
      if (actualTeams.has(team)) {
        pts += rPts;
        rp += rPts;
      }
    });
    if (rp) breakdown.push(roundLabels[key] + ': +' + rp);
  }

  // Final: 10pt per correct finalist + 25pt champion (scaled up)
  const arFin  = AR.final?.['fin'] || null;
  const arFinalists = new Set(Object.values(AR.sf || {}).filter(Boolean));
  const pFinalists = new Set(Object.values(bracket.sf || {}).filter(Boolean));
  const pFinW  = bracket.final?.['fin'] || null;
  let fp = 0;
  pFinalists.forEach(team => {
    if (arFinalists.has(team)) {
      pts += 10;
      fp += 10;
    }
  });
  if (arFin && pFinW === arFin) { pts += 25; fp += 25; }
  if (fp) breakdown.push('Final/Mester: +' + fp);

  // Bronze
  const arBronzeW = AR.bronze?.['bronze_w'] || null;
  const pBronzeW  = bracket.bronze?.['bronze_w'] || null;
  if (arBronzeW && pBronzeW === arBronzeW) { pts += 8; breakdown.push('Bronzekamp: +8'); }

  // Fun predictions (support ranked results with p1/p2/p3 and multiple selections)
  const cFun = fun || {};
  if (AR.fun) {
    let funPts = 0;
    const _toArray = (v) => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);

    Object.entries(FUN_PTS).forEach(([id, p]) => {
      const actual = AR.fun[id];
      const predicted = cFun[id];
      // Determine points for this prediction based on actual result shape
      let awarded = 0;
      if (!actual) {
        // nothing to award
      } else if (typeof actual === 'object' && (actual.p1 || actual.p2 || actual.p3)) {
        const a1 = _toArray(actual.p1);
        const a2 = _toArray(actual.p2);
        const a3 = _toArray(actual.p3);
        const pred = _toArray(predicted);
        if (pred.some(x => a1.includes(x))) awarded = p;
        else if (pred.some(x => a2.includes(x))) awarded = Math.round(p * 0.5);
        else if (pred.some(x => a3.includes(x))) awarded = Math.round(p * 0.25);
      } else {
        // legacy: actual is single or array -> treat as first place
        if (matchesAnswer(predicted, actual)) awarded = p;
      }

      if (awarded) { pts += awarded; funPts += awarded; }
    });
    if (funPts) breakdown.push('Sjove tips: +' + funPts);
  }

  return { pts, breakdown };
}

// ── Simple scoring ────────────────────────────────────────────────
export function calcSimpleScore(simple, AR) {
  if (!simple) return { pts: 0, breakdown: [] };
  let pts = 0, bd = [];
  const arChamp    = AR.final?.['fin'] || null;
  const arSF0      = AR.sf?.['sf_0'] || null, arSF1 = AR.sf?.['sf_1'] || null;
  const arRunnerUp = arSF0 && arSF0 !== arChamp ? arSF0 : (arSF1 && arSF1 !== arChamp ? arSF1 : null);
  const arQF0 = AR.qf?.['qf_0'] || null, arQF1 = AR.qf?.['qf_1'] || null;
  const arQF2 = AR.qf?.['qf_2'] || null, arQF3 = AR.qf?.['qf_3'] || null;
  const arSFL0 = arSF0 ? (arQF0 && arQF0 !== arSF0 ? arQF0 : (arQF1 && arQF1 !== arSF0 ? arQF1 : null)) : null;
  const arSFL1 = arSF1 ? (arQF2 && arQF2 !== arSF1 ? arQF2 : (arQF3 && arQF3 !== arSF1 ? arQF3 : null)) : null;
  const arSFLosers = [arSFL0, arSFL1].filter(Boolean);
  const arTop4 = [arChamp, arRunnerUp, ...arSFLosers].filter(Boolean);

  const scoreTop4Slot = (picked, exactTeam, exactPts, wrongPosPts, exactLabel) => {
    if (!picked) return;
    if (exactTeam && picked === exactTeam) {
      pts += exactPts;
      bd.push(exactLabel + ': +' + exactPts);
      return;
    }
    if (arTop4.includes(picked)) {
      pts += wrongPosPts;
      bd.push('Top 4 men forkert placering: +' + wrongPosPts);
    }
  };

  scoreTop4Slot(simple.top1, arChamp, 25, 5, 'Mester');
  scoreTop4Slot(simple.top2, arRunnerUp, 17, 5, 'Runner-up');
  scoreTop4Slot(simple.top3, arSFLosers[0], 8, 5, 'Nr. 3/4');
  scoreTop4Slot(simple.top4, arSFLosers[1], 8, 5, 'Nr. 3/4');

  const afun = AR.fun || {};
  const _toArray = (v) => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const applySimpleFun = (key, basePts, label) => {
    const actual = afun[key];
    const picked = simple[key];
    if (!actual) return;
    if (typeof actual === 'object' && (actual.p1 || actual.p2 || actual.p3)) {
      const a1 = _toArray(actual.p1);
      const a2 = _toArray(actual.p2);
      const a3 = _toArray(actual.p3);
      const pred = _toArray(picked);
      if (pred.some(x => a1.includes(x))) { pts += basePts; bd.push(label + ': +' + basePts); }
      else if (pred.some(x => a2.includes(x))) { const v = Math.round(basePts * 0.5); pts += v; bd.push(label + ' (2): +' + v); }
      else if (pred.some(x => a3.includes(x))) { const v = Math.round(basePts * 0.25); pts += v; bd.push(label + ' (3): +' + v); }
    } else {
      if (matchesAnswer(picked, actual)) { pts += basePts; bd.push(label + ': +' + basePts); }
    }
  };

  applySimpleFun('topscorer', 10, 'Topscorer');
  applySimpleFun('golden_ball', 10, 'Turnspiller');
  applySimpleFun('most_yellow', 6, 'Gule kort');
  applySimpleFun('most_goals_team', 8, 'Flest mål (hold)');
  return { pts, breakdown: bd };
}
