import { extractSimpleFromAdvanced, calcScore, calcSimpleScore } from '../../lib/scoring.js';
import { FUN_QUESTIONS } from '../../data/wc2026.js';

function pct(count, total) {
  if (!total) return '0%';
  return Math.round((count / total) * 100) + '%';
}

function groupBy(arr, keyFn) {
  const map = new Map();
  arr.forEach(item => {
    const k = keyFn(item) || '—';
    map.set(k, (map.get(k) || 0) + 1);
  });
  return map;
}

export default function StatsTab({ serverData }) {
  const entries = Array.isArray(serverData?.colleagues) ? serverData.colleagues : [];
  const total = entries.length;

  // Champion distribution (combine simple and advanced)
  const champCounts = new Map();
  const topScorerCounts = new Map();
  const modes = { simple: 0, advanced: 0 };
  const byDay = new Map();

  entries.forEach(e => {
    const mode = e.mode || 'simple';
    modes[mode] = (modes[mode] || 0) + 1;

    // Champion
    let top1 = null;
    if (mode === 'simple') top1 = (e.prediction || {}).top1 || null;
    else {
      const s = extractSimpleFromAdvanced(e.prediction?.bracket || e.prediction || {}, e.prediction?.fun || {});
      top1 = s.top1 || null;
    }
    if (top1) champCounts.set(top1, (champCounts.get(top1) || 0) + 1);

    // Topscorer (fun question)
    const ts = (e.prediction?.topscorer) || (e.prediction?.fun?.topscorer) || null;
    if (ts) topScorerCounts.set(ts, (topScorerCounts.get(ts) || 0) + 1);

    // Submitted day
    const d = e.submittedAt ? e.submittedAt.slice(0, 10) : 'unknown';
    byDay.set(d, (byDay.get(d) || 0) + 1);
  });

  // Top lists
  const champList = Array.from(champCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topScorerList = Array.from(topScorerCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Fun questions distribution
  const funDistributions = {};
  FUN_QUESTIONS.forEach(q => {
    funDistributions[q.id] = groupBy(entries, e => (e.prediction?.fun && e.prediction.fun[q.id]) || (e.prediction && e.prediction[q.id]) || null);
  });

  // Best predictions (if results available)
  const results = serverData?.results || null;
  let best = [];
  if (results) {
    best = entries.map(e => {
      let pts = 0;
      try {
        if (e.mode === 'advanced') {
          pts = (calcScore(e.prediction?.g || e.prediction?.g, e.prediction?.bracket || e.prediction, e.prediction?.fun || {}, results)?.pts) || 0;
        } else {
          pts = (calcSimpleScore(e.prediction || {}, results)?.pts) || 0;
        }
      } catch (err) {
        pts = 0;
      }
      return { name: e.name || 'Anonym', pts, submittedAt: e.submittedAt || '' };
    }).sort((a, b) => b.pts - a.pts).slice(0, 20);
  }

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>📊 Statistik</h2>
        <p>Læs kun — ingen ændringer. Oversigt over forudsigelser, fordeling af favoritter, sjove tips og top-forudsigelser.</p>
      </div>

      <div className="section-card">
        <strong>Deltagere:</strong> {total}
        <div style={{ marginTop: 8 }}>
          <strong>Mode:</strong> Simple {modes.simple || 0} — Advanced {modes.advanced || 0}
        </div>
      </div>

      <div className="section-card">
        <h3>Favorit til mesterskabet</h3>
        {champList.length === 0 ? <p>Ingen data endnu.</p> : (
          <table className="simple-table">
            <thead><tr><th>Hold</th><th>Antal</th><th>%</th></tr></thead>
            <tbody>
              {champList.map(([team, cnt]) => (
                <tr key={team}><td>{team}</td><td>{cnt}</td><td>{pct(cnt, total)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section-card">
        <h3>Topscorer-fordeling</h3>
        {topScorerList.length === 0 ? <p>Ingen data.</p> : (
          <ol>
            {topScorerList.slice(0, 10).map(([player, cnt]) => (
              <li key={player}>{player} — {cnt} ({pct(cnt, total)})</li>
            ))}
          </ol>
        )}
      </div>

      <div className="section-card">
        <h3>Sjove tips (udvalgte)</h3>
        {FUN_QUESTIONS.slice(0, 4).map(q => (
          <div key={q.id} style={{ marginBottom: 12 }}>
            <strong>{q.title}</strong>
            <div style={{ marginTop: 6 }}>
              {Array.from(funDistributions[q.id].entries()).sort((a,b)=>b[1]-a[1]).map(([val, cnt]) => (
                <div key={val} style={{ fontSize: 14 }}>{val || 'Ingen valg'} — {cnt} ({pct(cnt, total)})</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-card">
        <h3>Indsendelser pr. dag</h3>
        <div>
          {Array.from(byDay.entries()).sort().map(([d, cnt]) => (
            <div key={d} style={{ marginBottom: 4 }}>{d}: {cnt}</div>
          ))}
        </div>
      </div>

      {results && (
        <div className="section-card">
          <h3>Top-forudsigelser (efter point)</h3>
          {best.length === 0 ? <p>Ingen resultater/points.</p> : (
            <table className="simple-table">
              <thead><tr><th>Navn</th><th>Point</th><th>Indsendt</th></tr></thead>
              <tbody>
                {best.map((b, i) => (
                  <tr key={i}><td>{b.name}</td><td>{b.pts}</td><td>{b.submittedAt ? b.submittedAt.slice(0,10) : ''}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
