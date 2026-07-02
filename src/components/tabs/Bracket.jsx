import { useEffect, useRef, useCallback } from 'react';
import { R32, R16_PAIRS, QF_PAIRS, SF_PAIRS, FLAG_CODES } from '../../data/wc2026.js';
import { COMBO } from '../../data/combo.js';

function resolveSlot(slot, g, third) {
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

function flagImg(team) {
  const code = FLAG_CODES[team];
  if (!code) return '';
  return `<span class="fi fi-${code}" style="margin-right:5px"></span>`;
}

export default function BracketTab({ S, onPick, showHeader = true, notReadyMessage, readOnly = false, onResetBracket, AR = null }) {
  const containerRef = useRef(null);

  const isReady = () => {
    const allGroups = Object.keys({A:'',B:'',C:'',D:'',E:'',F:'',G:'',H:'',I:'',J:'',K:'',L:''}).every(k => {
      const g = S.g[k] || {};
      return g.p1 && g.p2 && g.p3;
    });
    return allGroups && (S.third || []).length === 8;
  };

  const renderBracket = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    if (!isReady()) {
      const msg = notReadyMessage || 'Udfyld grupperunden og vælg de 8 bedste 3\'ere for at se bracket\'en.';
      container.innerHTML = '<div class="bracket-not-ready">' + msg + '</div>';
      return;
    }

    const H = 64, CW = 162, CG = 28;
    const LINE = '#475569';

    const g = S.g || {}, third = S.third || [];
    const r32Teams = R32.map(m => ({ a: resolveSlot(m.a, g, third), b: resolveSlot(m.b, g, third) }));
    const r32W = R32.map(m => S.r32[m.id] || null);
    const r16W = R16_PAIRS.map((_, mi) => S.r16['r16_' + mi] || null);
    const qfW  = QF_PAIRS.map((_, mi)  => S.qf['qf_' + mi]   || null);
    const sfW  = SF_PAIRS.map((_, mi)  => S.sf['sf_' + mi]    || null);
    const finW = S.final['fin'] || null;
    const sfLoser0 = sfW[0] ? (qfW[0] === sfW[0] ? qfW[1] : qfW[0]) : null;
    const sfLoser1 = sfW[1] ? (qfW[2] === sfW[1] ? qfW[3] : qfW[2]) : null;
    const bronzeW  = S.bronze['bronze_w'] || null;

    // precompute which teams this prediction places in each round
    // NOTE: For r32 we want the teams the user predicted to *advance* (winners),
    // not all teams that appear in the R32 matches. Use the r32 winners array.
    const predictedByRound = {
      r32: new Set(r32W.filter(Boolean)),
      r16: new Set(Object.values(S.r16 || {}).filter(Boolean)),
      qf:  new Set(Object.values(S.qf || {}).filter(Boolean)),
      sf:  new Set(Object.values(S.sf || {}).filter(Boolean)),
      final: new Set(Object.values(S.final || {}).filter(Boolean)),
      bronze: new Set(Object.values(S.bronze || {}).filter(Boolean))
    };

    // compute which teams actually appear in each round according to AR
    // We build each round as a union of that round and any later rounds (matching scoring rules)
    const actualByRound = { r32: new Set(), r16: new Set(), qf: new Set(), sf: new Set(), final: new Set(), bronze: new Set() };
    if (AR) {
      const ag = AR.g || {};
      const athird = AR.third || [];
      // For actual progression we consider the teams that actually *advanced* from
      // R32 => those appear in AR.r16. Fallback to resolving slots only if AR.r16 missing.
      const ar16Vals = Object.values(AR.r16 || {}).filter(Boolean);
      if (ar16Vals.length > 0) {
        ar16Vals.forEach(t => actualByRound.r32.add(t));
      } else {
        const ar32Teams = R32.map(m => ({ a: resolveSlot(m.a, ag, athird), b: resolveSlot(m.b, ag, athird) }));
        ar32Teams.forEach(t => {
          [t.a, t.b].filter(Boolean).forEach(x => actualByRound.r32.add(x));
        });
      }
      const roundOrder = ['r32', 'r16', 'qf', 'sf'];
      for (let i = 0; i < roundOrder.length; i++) {
        const key = roundOrder[i];
        // include teams from this round and any later rounds
        for (let j = i; j < roundOrder.length; j++) {
          const store = AR[roundOrder[j]] || {};
          Object.values(store).filter(Boolean).forEach(t => actualByRound[key].add(t));
        }
        // also include finalists/bronze winners as they imply progression
        if (AR.final) Object.values(AR.final).filter(Boolean).forEach(t => actualByRound[key].add(t));
        if (AR.bronze) Object.values(AR.bronze).filter(Boolean).forEach(t => actualByRound[key].add(t));
      }
      // ensure final/bronze sets also include their own values
      Object.values(AR.final || {}).filter(Boolean).forEach(t => actualByRound.final.add(t));
      Object.values(AR.bronze || {}).filter(Boolean).forEach(t => actualByRound.bronze.add(t));
    }

    function teamGetsProgressionPoints(roundKey, team, AR) {
      if (!AR || !team) return false;
      const roundOrder = ['r32', 'r16', 'qf', 'sf'];
      const startIdx = roundOrder.indexOf(roundKey);
      if (startIdx === -1) {
        // final/bronze exact checks
        if (roundKey === 'final') {
          return !!(AR.final && AR.final.fin && AR.final.fin === team);
        }
        if (roundKey === 'bronze') {
          return !!(AR.bronze && AR.bronze.bronze_w && AR.bronze.bronze_w === team);
        }
        return false;
      }
      const actualTeams = new Set();
      for (let j = startIdx; j < roundOrder.length; j++) {
        const aStore = AR[roundOrder[j]] || {};
        Object.values(aStore).filter(Boolean).forEach(t => actualTeams.add(t));
      }
      if (AR.final) Object.values(AR.final).filter(Boolean).forEach(t => actualTeams.add(t));
      if (AR.bronze) Object.values(AR.bronze).filter(Boolean).forEach(t => actualTeams.add(t));
      return actualTeams.has(team);
    }

    function mkCard(id, rk, tA, tB, w) {
      const div = document.createElement('div');
      div.className = 'bm';
      [tA, tB].forEach(t => {
        const s = document.createElement('div');
        // determine scored / win / lose styling when AR (results) provided
        let cls = 'bm-slot';
        if (readOnly) cls += ' readonly';
        if (!t) cls += ' tbd';

        if (t) {
          // if actual results provided, mark slots that give progression points as 'scored'
          if (AR) {
            const predictedHere = predictedByRound[rk] && predictedByRound[rk].has(t);
            const actuallyHere = actualByRound[rk] && actualByRound[rk].has(t);
            const roundDecided = actualByRound[rk] && actualByRound[rk].size > 0;
            // correct prediction for that round
            if (predictedHere && actuallyHere) cls += ' scored';
            // wrong prediction when the round is decided but the team did not appear
            else if (predictedHere && !actuallyHere && roundDecided) cls += ' wrong';
            // still highlight the user's own picks (win) in interactive bracket views
            else if (!readOnly && w === t) cls += ' win';
          } else {
            if (w === t) cls += ' win';
            else if (w) cls += ' lose';
          }
        }
        s.className = cls;
        if (t) {
          s.innerHTML = flagImg(t) + '<span>' + t + '</span>';
          if (!readOnly && typeof onPick === 'function') {
            s.onclick = () => onPick(rk, id, t);
          }
        } else {
          s.textContent = 'TBD';
        }
        div.appendChild(s);
      });
      return div;
    }

    const r32C = R32.map((m, i) => mkCard(m.id, 'r32', r32Teams[i].a, r32Teams[i].b, r32W[i]));
    const r16C = R16_PAIRS.map(([i, j], mi) => mkCard('r16_' + mi, 'r16', r32W[i], r32W[j], r16W[mi]));
    const qfC  = QF_PAIRS.map(([i, j], mi)  => mkCard('qf_' + mi,  'qf',  r16W[i], r16W[j], qfW[mi]));
    const sfC  = SF_PAIRS.map(([i, j], mi)  => mkCard('sf_' + mi,  'sf',  qfW[i],  qfW[j],  sfW[mi]));
    const finC   = mkCard('fin', 'final', sfW[0], sfW[1], finW);
    const bronzeC = mkCard('bronze_w', 'bronze', sfLoser0, sfLoser1, bronzeW);

    const tops8 = [0, 1, 2, 3, 4, 5, 6, 7].map(i => i * H);
    const tops4 = [0, 1, 2, 3].map(i => H / 2 + i * 2 * H);
    const tops2 = [0, 1].map(i => 3 * H / 2 + i * 4 * H);
    const tops1 = [7 * H / 2];

    function mkBktCol(cards, tops, label, side, sfMode) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center';
      const lbl = document.createElement('div');
      lbl.className = 'bkt-col-label';
      lbl.style.cssText = 'width:' + (CW + CG) + 'px;text-align:center';
      lbl.textContent = label;
      wrap.appendChild(lbl);
      const body = document.createElement('div');
      body.style.cssText = 'position:relative;height:' + (8 * H) + 'px;width:' + (CW + CG) + 'px;flex-shrink:0;overflow:visible';
      const cardX = side === 'left' ? 0 : CG;
      cards.forEach((card, i) => {
        card.style.cssText = 'position:absolute;top:' + tops[i] + 'px;left:' + cardX + 'px;width:' + CW + 'px';
        body.appendChild(card);
        const stubW = sfMode ? CG : CG / 2;
        const stubX = side === 'left' ? CW : (sfMode ? 0 : CG / 2);
        const stub = document.createElement('div');
        stub.style.cssText = 'position:absolute;height:2px;width:' + stubW + 'px;background:' + LINE + ';top:' + (tops[i] + H / 2 - 1) + 'px;left:' + stubX + 'px';
        body.appendChild(stub);
      });
      if (!sfMode) {
        for (let p = 0; p < cards.length / 2; p++) {
          const i = p * 2, j = i + 1;
          const y1 = tops[i] + H / 2, y2 = tops[j] + H / 2, midY = (y1 + y2) / 2;
          const vX = side === 'left' ? CW + CG / 2 - 1 : CG / 2 - 1;
          const vl = document.createElement('div');
          vl.style.cssText = 'position:absolute;width:2px;height:' + (y2 - y1) + 'px;background:' + LINE + ';top:' + y1 + 'px;left:' + vX + 'px';
          body.appendChild(vl);
          const outX = side === 'left' ? CW + CG / 2 : 0;
          const ol = document.createElement('div');
          ol.style.cssText = 'position:absolute;height:2px;width:' + (CG / 2) + 'px;background:' + LINE + ';top:' + (midY - 1) + 'px;left:' + outX + 'px';
          body.appendChild(ol);
        }
      }
      wrap.appendChild(body);
      return wrap;
    }

    function mkFinalCol(bronzeCard, finCard) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex-shrink:0';
      const body = document.createElement('div');
      body.style.cssText = 'position:relative;height:' + (8 * H) + 'px;width:' + CW + 'px;flex-shrink:0';
      const blbl = document.createElement('div');
      blbl.className = 'bkt-col-label';
      blbl.style.cssText = 'position:absolute;top:' + (H / 2 - 20) + 'px;left:0;width:' + CW + 'px;text-align:center;color:#d97706;font-size:.75em';
      blbl.textContent = '🥉 Bronzekamp';
      body.appendChild(blbl);
      bronzeCard.style.cssText = 'position:absolute;top:' + (H / 2) + 'px;left:0;width:' + CW + 'px;border:2px solid #d97706';
      body.appendChild(bronzeCard);
      const flbl = document.createElement('div');
      flbl.className = 'bkt-col-label';
      flbl.style.cssText = 'position:absolute;top:' + (7 * H / 2 - 22) + 'px;left:0;width:' + CW + 'px;text-align:center;color:#3b82f6;font-size:.8em';
      flbl.textContent = '🏆 Finale';
      body.appendChild(flbl);
      finCard.style.cssText = 'position:absolute;top:' + (7 * H / 2) + 'px;left:0;width:' + CW + 'px;border:2px solid #fbbf24';
      body.appendChild(finCard);
      wrap.appendChild(body);
      return wrap;
    }

    const leftHalf = document.createElement('div');
    leftHalf.style.cssText = 'display:flex;align-items:flex-start';
    leftHalf.appendChild(mkBktCol(r32C.slice(0, 8), tops8, 'R32', 'left', false));
    leftHalf.appendChild(mkBktCol(r16C.slice(0, 4), tops4, 'R16', 'left', false));
    leftHalf.appendChild(mkBktCol(qfC.slice(0, 2),  tops2, 'Kvartfinale', 'left', false));
    leftHalf.appendChild(mkBktCol([sfC[0]], tops1, 'Semifinale', 'left', true));

    const rightHalf = document.createElement('div');
    rightHalf.style.cssText = 'display:flex;align-items:flex-start';
    rightHalf.appendChild(mkBktCol([sfC[1]], tops1, 'Semifinale', 'right', true));
    rightHalf.appendChild(mkBktCol(qfC.slice(2, 4), tops2, 'Kvartfinale', 'right', false));
    rightHalf.appendChild(mkBktCol(r16C.slice(4, 8), tops4, 'R16', 'right', false));
    rightHalf.appendChild(mkBktCol(r32C.slice(8, 16), tops8, 'R32', 'right', false));

    container.appendChild(leftHalf);
    container.appendChild(mkFinalCol(bronzeC, finC));
    container.appendChild(rightHalf);

    const naturalW = 4 * (CW + CG) * 2 + CW + 60;
    const available = container.parentElement?.clientWidth || window.innerWidth;
    const scale = Math.min(1, available / naturalW);
    container.style.zoom = scale.toFixed(4);
    container.parentElement.style.minHeight = Math.ceil((8 * H + 45) * scale) + 'px';
  }, [S, onPick, AR]);

  useEffect(() => {
    renderBracket();
  }, [renderBracket]);

  return (
    <div className="tab-content">
      {showHeader && (
        <div className="section-header">
          <h2>🏆 Bracket</h2>
          <p>Klik på et hold for at vælge vinderen. Klik igen for at fortryde.</p>
          {!readOnly && (
            <div className="submit-row" style={{ marginTop: 12 }}>
              <button className="btn-ghost btn-sm" onClick={() => onResetBracket?.()}>🧹 Nulstil bracket</button>
            </div>
          )}
        </div>
      )}
      <div className="bracket-scroll">
        <div ref={containerRef} className="bracket" />
      </div>
    </div>
  );
}
