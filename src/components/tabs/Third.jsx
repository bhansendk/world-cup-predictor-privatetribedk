import { GROUPS } from '../../data/wc2026.js';
import { FlagSpan } from '../FormFields.jsx';

export default function ThirdTab({ S, setThird }) {
  const sel = S.third || [];
  const allGroupsFilled = Object.keys(GROUPS).every(k => {
    const g = S.g[k] || {};
    return g.p1 && g.p2 && g.p3;
  });

  const toggle = (k) => {
    const idx = sel.indexOf(k);
    if (idx >= 0) setThird(sel.filter(x => x !== k));
    else if (sel.length < 8) setThird([...sel, k]);
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>🥉 Bedste 3'ere</h2>
        <p>
          Vælg de 8 grupper hvis 3'er går videre til R32 ({sel.length}/8 valgt).
          De 8 bedste tredjepladser avancerer — påvirker bracket-seeding.
          {!allGroupsFilled && <span className="warn-txt"> Udfyld grupperunden først.</span>}
        </p>
        {sel.length === 8 && <div className="success-banner">✅ 8 bedste 3'ere valgt! Gå videre til Bracket.</div>}
      </div>
      <div className="third-grid">
        {Object.entries(GROUPS).map(([k, g]) => {
          const p3 = (S.g[k] || {}).p3;
          const isSel = sel.includes(k);
          const isBlocked = !isSel && sel.length >= 8;
          return (
            <div
              key={k}
              className={'third-item' + (isSel ? ' sel' : '') + (isBlocked ? ' blocked' : '')}
              onClick={() => !isBlocked && toggle(k)}
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
  );
}
