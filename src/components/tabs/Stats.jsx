import { extractSimpleFromAdvanced, calcScore, calcSimpleScore } from '../../lib/scoring.js';
import { useMemo } from 'react';
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

function pctNum(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
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

  // Helper: get names of colleagues who picked a given simple field (top1, topscorer, or any fun question id)
  function getHoldersForField(fieldId, value) {
    if (!value) return [];
    return entries.filter(e => {
      const mode = e.mode || 'simple';
      const simple = mode === 'advanced'
        ? extractSimpleFromAdvanced(e.prediction?.bracket || e.prediction || {}, e.prediction?.fun || {})
        : (e.prediction || {});
      return simple[fieldId] === value;
    }).map(e => e.name || e.displayName || e.id || 'Anonym');
  }

  // Helper: get holders for advanced group p1 picks
  function getGroupP1Holders(groupKey, team) {
    if (!team) return [];
    return entries.filter(e => {
      const pick = e.prediction?.g && e.prediction.g[groupKey] ? e.prediction.g[groupKey].p1 : null;
      return pick === team;
    }).map(e => e.name || e.displayName || e.id || 'Anonym');
  }

  // Pretty name helpers — render initials and nicer display for small avatars
  function initials(name) {
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + (parts[parts.length-1][0] || '')).toUpperCase();
  }

  function renderHoldersPreview(holders) {
    if (!holders || holders.length === 0) return null;
    const maxShow = 6;
    const visible = holders.slice(0, maxShow);
    return (
      <div className="holders-preview" title={holders.join(', ')} style={{ gap: 6, alignItems: 'center', display: 'flex' }}>
        {visible.map(h => (
          <div key={h} title={h} className="holder-badge" style={{ width: 22, height: 22, borderRadius: 999, background: '#0f172a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.04)' }}>{initials(h)}</div>
        ))}
        {holders.length > maxShow ? <div style={{ fontSize: 12, color: '#94a3b8' }}>+{holders.length - maxShow}</div> : null}
      </div>
    );
  }

  

  // Champion distribution (combine simple and advanced) — memoized
  const { champCounts, topScorerCounts, modes } = useMemo(() => {
    const cCounts = new Map();
    const tsCounts = new Map();
    const m = { simple: 0, advanced: 0 };
    entries.forEach(e => {
      const mode = e.mode || 'simple';
      m[mode] = (m[mode] || 0) + 1;
      let top1 = null;
      if (mode === 'simple') top1 = (e.prediction || {}).top1 || null;
      else {
        const s = extractSimpleFromAdvanced(e.prediction?.bracket || e.prediction || {}, e.prediction?.fun || {});
        top1 = s.top1 || null;
      }
      if (top1) cCounts.set(top1, (cCounts.get(top1) || 0) + 1);
      const ts = (e.prediction?.topscorer) || (e.prediction?.fun?.topscorer) || null;
      if (ts) tsCounts.set(ts, (tsCounts.get(ts) || 0) + 1);
    });
    return { champCounts: cCounts, topScorerCounts: tsCounts, modes: m };
  }, [entries]);

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

  // group 1st place picks (advanced predictions) — memoized
  const groupP1Counts = useMemo(() => {
    const out = {};
    Object.entries(GROUPS).forEach(([gk, g]) => {
      const map = new Map();
      entries.forEach(e => {
        const pick = e.prediction?.g?.[gk]?.p1 || null;
        if (pick) map.set(pick, (map.get(pick) || 0) + 1);
      });
      out[gk] = map;
    });
    return out;
  }, [entries]);

  // Fun questions distribution — memoized
  const funDistributions = useMemo(() => {
    const fd = {};
    FUN_QUESTIONS.forEach(q => {
      fd[q.id] = groupBy(entries, e => (e.prediction?.fun && e.prediction.fun[q.id]) || (e.prediction && e.prediction[q.id]) || null);
    });
    return fd;
  }, [entries]);

  const results = serverData?.results || null;

  // Additional "rare correct" statistics when results are available
  let rareCorrect = null;
  if (results) {
    try {
      const actual = extractSimpleFromAdvanced(results.bracket || results, results.fun || {});

      // counts of predictions already computed for champions and fun questions
      // reuse champCounts and funDistributions for popularity metrics
      const popularity = {
        top1: champCounts, // Map team -> count
        ...Object.fromEntries(FUN_QUESTIONS.map(q => [q.id, funDistributions[q.id]]))
      };

      // For each participant, compute which of the tracked fields they got correct and a rarity score
      const candidateFields = ['top1', 'top2', 'top3', 'top4', ...FUN_QUESTIONS.filter(f=>['topscorer','golden_ball','most_yellow','most_goals_team'].includes(f.id)).map(f=>f.id)];

      const perPerson = entries.map(e => {
        const name = e.name || e.displayName || e.id || 'Anonym';
        const mode = e.mode || 'simple';
        const simple = mode === 'advanced'
          ? extractSimpleFromAdvanced(e.prediction?.bracket || e.prediction || {}, e.prediction?.fun || {})
          : (e.prediction || {});
        let correct = [];
        let raritySum = 0;
        candidateFields.forEach(f => {
          const picked = simple[f];
          const actualVal = actual[f];
          if (!picked || !actualVal) return;
          if (picked === actualVal) {
            correct.push(f);
            const popMap = popularity[f] || new Map();
            const pop = popMap.get(picked) || 1;
            raritySum += 1 / pop;
          }
        });
        return { name, correct, raritySum, correctCount: correct.length };
      });

      // rank by raritySum then by correctCount
      perPerson.sort((a,b) => b.raritySum - a.raritySum || b.correctCount - a.correctCount);

      // also list rare correct predictions (predicted correctly but low popularity)
      const rareItems = [];
      // check champion and the selected fun questions
      const checkFields = ['top1', 'topscorer', 'golden_ball', 'most_yellow', 'most_goals_team'];
      checkFields.forEach(f => {
        const actualVal = actual[f];
        if (!actualVal) return;
        const popMap = popularity[f] || new Map();
        const pop = popMap.get(actualVal) || 0;
        if (pop > 0 && pop <= Math.max(3, Math.round(total * 0.05))) { // consider rare if <= max(3,5% of entries)
          // find who had it
          const holders = entries.filter(e => {
            const mode = e.mode || 'simple';
            const simple = mode === 'advanced'
              ? extractSimpleFromAdvanced(e.prediction?.bracket || e.prediction || {}, e.prediction?.fun || {})
              : (e.prediction || {});
            return simple[f] === actualVal;
          }).map(e => e.name || e.displayName || e.id || 'Anonym');
          rareItems.push({ field: f, value: actualVal, count: pop, holders });
        }
      });

      rareCorrect = { perPerson, rareItems };
    } catch (err) {
      rareCorrect = null;
    }
  }

  return (
    <div className="tab-content">
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        <div className="section-card stat-tile">
          <div className="stat-label">Deltagere</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="section-card stat-tile">
          <div className="stat-label">Mest brugt mode</div>
          <div className="stat-value">{modes.simple >= modes.advanced ? 'Simple' : 'Advanced'}</div>
        </div>
        <div className="section-card stat-tile">
          <div className="stat-label">Top champion</div>
          <div className="stat-value">{topChampion ? `${topChampion.team} (${pct(topChampion.count, total)})` : '—'}</div>
        </div>
        <div className="section-card stat-tile">
          <div className="stat-label">Gennemsnitlige point</div>
          <div className="stat-value">{avgPoints !== null ? avgPoints : 'N/A'}</div>
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
          <div className="chart-compact">
            <div className="chart-wrap">
              <Pie data={{
                labels: champList.map(c => c[0]),
                datasets: [{ data: champList.map(c => c[1]), backgroundColor: champList.map((_, i) => `hsl(${(i*50)%360} 70% 50%)`) }]
              }} options={{
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const label = ctx.label || '';
                        const value = ctx.parsed || 0;
                        const sum = (ctx.dataset && ctx.dataset.data) ? ctx.dataset.data.reduce((a,b)=>a+b,0) : 0;
                        const percent = sum ? Math.round((value/sum)*100) : 0;
                        return `${label}: ${value} (${percent}%)`;
                      }
                    }
                  },
                  legend: { position: 'bottom' }
                }
              }} />
            </div>
            <div style={{ minWidth: 260 }}>
              <table className="simple-table">
                <thead><tr><th>Hold</th><th>Antal</th><th style={{width:120}}>%</th></tr></thead>
                <tbody>
                  {champList.map(([team, cnt]) => {
                    const holders = getHoldersForField('top1', team);
                    const title = `${cnt} (${pct(cnt, total)})` + (holders.length ? ` — ${holders.join(', ')}` : '');
                    return (
                      <tr key={team} className="champ-row">
                          <td className="champ-name">
                            <div className="hover-reveal" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div>{team}</div>
                              {renderHoldersPreview(holders)}
                            </div>
                          </td>
                        <td style={{width:60}}>{cnt}</td>
                        <td>
                              <div className="mini-bar-bg" title={title}>
                              <div className="mini-bar" style={{ width: `${pctNum(cnt, total)}%` }} />
                            </div>
                          </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="section-card">
        <h3>Topscorer-fordeling</h3>
        {topScorerList.length === 0 ? <p>Ingen data.</p> : (
          <div>
            {topScorerList.slice(0, 10).map(([player, cnt]) => {
              const holders = getHoldersForField('topscorer', player);
              const title = `${cnt} (${pct(cnt, total)})` + (holders.length ? ` — ${holders.join(', ')}` : '');
              return (
                <div key={player} title={holders.join(', ')} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div className="hover-reveal" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>{player}</div>
                    {renderHoldersPreview(holders)}
                  </div>
                  <div style={{ minWidth: 140 }}>
                    <div className="mini-bar-bg" title={title}><div className="mini-bar" style={{ width: `${pctNum(cnt, total)}%` }} /></div>
                  </div>
                  <div style={{ width: 56, textAlign: 'right' }}>{cnt} ({pct(cnt, total)})</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="section-card">
        <h3>Sjove tips</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {FUN_QUESTIONS.map(q => (
            <div key={q.id} style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 6 }}>{q.title}</div>
              {Array.from(funDistributions[q.id].entries()).sort((a,b)=>b[1]-a[1]).map(([val, cnt]) => {
                const holders = getHoldersForField(q.id, val);
                const title = `${cnt} (${pct(cnt, total)})` + (holders.length ? ` — ${holders.join(', ')}` : '');
                return (
                  <div key={val} title={holders.join(', ')} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div className="hover-reveal" style={{ flex: 1, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>{val || 'Ingen valg'}</div>
                        {renderHoldersPreview(holders)}
                      </div>
                      <div style={{ width: 130 }}><div className="mini-bar-bg" title={title}><div className="mini-bar" style={{ width: `${pctNum(cnt, total)}%` }} /></div></div>
                      <div style={{ width: 48, textAlign: 'right', color: '#94a3b8' }}>{cnt}</div>
                    </div>
                );
              })}
            </div>
          ))}
        </div>
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
                  <Bar data={{ labels, datasets: [{ data, backgroundColor: labels.map((_,i)=>`hsl(${(i*60)%360} 70% 45%)`) }] }} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: (ctx) => { const value = ctx.parsed && typeof ctx.parsed === 'object' ? (ctx.parsed.x ?? ctx.parsed) : (ctx.parsed || 0); const sum = (ctx.dataset && ctx.dataset.data) ? ctx.dataset.data.reduce((a,b)=>a+b,0) : 0; const pct = sum ? Math.round((value/sum)*100) : 0; return `${ctx.label}: ${value} (${pct}%)`; } } }, legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }} />
                </div>
                    <div style={{ marginTop: 8 }}>
                      {labels.map(t => {
                        const cnt = map.get(t) || 0;
                        const holders = getGroupP1Holders(gk, t);
                        const title = `${cnt} (${pct(cnt, total)})` + (holders.length ? ` — ${holders.join(', ')}` : '');
                        return (
                          <div key={t} title={holders.join(', ')} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div className="hover-reveal" style={{ flex: 1, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>{t}{renderHoldersPreview(holders)}</div>
                            <div style={{ width: 110 }}><div className="mini-bar-bg" title={title}><div className="mini-bar" style={{ width: `${pctNum(cnt, total)}%` }} /></div></div>
                            <div style={{ width: 44, textAlign: 'right', color: '#94a3b8' }}>{cnt}</div>
                          </div>
                        );
                      })}
                    </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-forudsigelser fjernet */}
      {rareCorrect && (
        <div className="section-card">
          <h3>Sjældne korrekte forudsigelser</h3>
          {rareCorrect.rareItems.length === 0 ? (
            <p>Ingen særligt sjældne korrekte forudsigelser fundet (eller for få deltagere).</p>
          ) : (
            <div>
              {rareCorrect.rareItems.map(it => (
                <div key={it.field} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: '#fef3c7' }}>{it.field} — {it.value}</div>
                  <div style={{ color: '#cbd5e1', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>Kun {it.count} forudsigelser havde dette; <span className="hover-reveal">{renderHoldersPreview(it.holders)}</span></div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Top personer med mest sjældne korrekte forudsigelser</div>
            <ol>
              {rareCorrect.perPerson.slice(0,10).filter(p=>p.correctCount>0).map(p => (
                <li key={p.name} style={{ marginBottom: 6 }}>
                  <strong style={{ color: '#e2e8f0' }}>{p.name}</strong>: {p.correctCount} korrekte ({p.raritySum.toFixed(2)} sjældenhed)
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
