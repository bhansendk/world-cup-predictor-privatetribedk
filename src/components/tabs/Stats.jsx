import { extractSimpleFromAdvanced, calcScore, calcSimpleScore } from '../../lib/scoring.js';
import { FUN_QUESTIONS, GROUPS } from '../../data/wc2026.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Title);

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

    // don't store submission dates here (privacy)
  });

  // Top lists
  const champList = Array.from(champCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topScorerList = Array.from(topScorerCounts.entries()).sort((a, b) => b[1] - a[1]);

  // derive a few more aggregated datasets
  const topChampion = champList[0] ? { team: champList[0][0], count: champList[0][1] } : null;
  const resultsAvailable = !!serverData?.results;
  const avgPoints = resultsAvailable && entries.length ? Math.round(entries.reduce((s, e) => {
    try {
      const pts = e.mode === 'advanced'
        ? (calcScore(e.prediction?.g || e.prediction?.g, e.prediction?.bracket || e.prediction, e.prediction?.fun || {}, serverData.results)?.pts) || 0
        : (calcSimpleScore(e.prediction || {}, serverData.results)?.pts) || 0;
      return s + pts;
    } catch { return s + 0; }
  }, 0) / entries.length) : null;

  // (removed per-day date distribution for privacy)

  // group 1st place picks (advanced predictions)
  const groupP1Counts = {};
  Object.entries(GROUPS).forEach(([gk, g]) => {
    const map = new Map();
    entries.forEach(e => {
      const pick = e.prediction?.g?.[gk]?.p1 || null;
      if (pick) map.set(pick, (map.get(pick) || 0) + 1);
    });
    groupP1Counts[gk] = map;
  });

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
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        <div className="section-card stat-tile">
          <div style={{ color: '#93c5fd', fontWeight: 700 }}>Deltagere</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{total}</div>
        </div>
        <div className="section-card stat-tile">
          <div style={{ color: '#93c5fd', fontWeight: 700 }}>Mest brugt mode</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{modes.simple >= modes.advanced ? 'Simple' : 'Advanced'}</div>
        </div>
        <div className="section-card stat-tile">
          <div style={{ color: '#93c5fd', fontWeight: 700 }}>Top champion</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{topChampion ? `${topChampion.team} (${pct(topChampion.count, total)})` : '—'}</div>
        </div>
        <div className="section-card stat-tile">
          <div style={{ color: '#93c5fd', fontWeight: 700 }}>Gennemsnitlige point</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{avgPoints !== null ? avgPoints : 'N/A'}</div>
        </div>
      </div>
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
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 320 }}>
              <Pie data={{
                labels: champList.map(c => c[0]),
                datasets: [{ data: champList.map(c => c[1]), backgroundColor: champList.map((_, i) => `hsl(${(i*50)%360} 70% 50%)`) }]
              }} />
            </div>
            <div style={{ minWidth: 260 }}>
              <table className="simple-table">
                <thead><tr><th>Hold</th><th>Antal</th><th>%</th></tr></thead>
                <tbody>
                  {champList.map(([team, cnt]) => (
                    <tr key={team}><td>{team}</td><td>{cnt}</td><td>{pct(cnt, total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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

      {/* Per-day submission dates removed for privacy */}

      <div className="section-card">
        <h3>Gruppevalg — mest valgte 1'ere (advanced)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {Object.entries(GROUPS).map(([gk, g]) => {
            const map = groupP1Counts[gk] || new Map();
            const labels = g.teams || [];
            const data = labels.map(t => map.get(t) || 0);
            return (
              <div key={gk} className="chart-card">
                <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 8 }}>{g.name}</div>
                <div style={{ height: 120 }}>
                  <Bar data={{ labels, datasets: [{ data, backgroundColor: labels.map((_,i)=>`hsl(${(i*60)%360} 70% 45%)`) }] }} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {results && (
        <div className="section-card">
          <h3>Top-forudsigelser (efter point)</h3>
          {best.length === 0 ? <p>Ingen resultater/points.</p> : (
            <table className="simple-table">
              <thead><tr><th>Navn</th><th>Point</th></tr></thead>
              <tbody>
                {best.map((b, i) => (
                  <tr key={i}><td>{b.name}</td><td>{b.pts}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
