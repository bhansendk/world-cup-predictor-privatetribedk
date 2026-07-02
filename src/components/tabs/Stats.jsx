import { extractSimpleFromAdvanced, calcScore, calcSimpleScore } from '../../lib/scoring.js';
import { useMemo, useState } from 'react';
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

  // Render a hover popover with full-holder list (shown only on parent hover)
  function renderHoldersPopover(holders) {
    if (!holders || holders.length === 0) return null;
    return (
      <div className="holders-popover" role="status" aria-hidden style={{ display: 'none' }}>
        <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>{holders.length} personer</div>
        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {holders.map(h => (
              <li key={h} style={{ padding: '4px 0', color: '#e2e8f0', fontSize: 13 }}>{h}</li>
            ))}
          </ul>
        </div>
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

  // --- Team progression disagreement analysis -----------------
  const STAGES = ['Group', 'R32', 'R16', 'QF', 'SF', 'Final', 'Champion'];
  const [selectedTeam, setSelectedTeam] = useState(() => topChampion?.team || null);

  // Build a list of all teams mentioned in GROUPS and predictions
  const allTeams = useMemo(() => {
    const set = new Set();
    Object.values(GROUPS).forEach(g => (g.teams || []).forEach(t => set.add(t)));
    // also include any teams referenced in simple champs/topscorer etc
    entries.forEach(e => {
      const mode = e.mode || 'simple';
      const simple = mode === 'advanced'
        ? extractSimpleFromAdvanced(e.prediction?.bracket || e.prediction || {}, e.prediction?.fun || {})
        : (e.prediction || {});
      ['top1','top2','top3','top4'].forEach(k => { if (simple[k]) set.add(simple[k]); });
    });
    return Array.from(set).sort();
  }, [entries]);

  // For a given prediction, return the maximal stage predicted for each team
  function teamStagesFromPrediction(pred, mode) {
    const map = new Map();
    try {
      if (!pred) return map;
      if (mode === 'advanced') {
        const br = pred.bracket || pred || {};
        ['r32','r16','qf','sf'].forEach((rk, idx) => {
          Object.values(br[rk] || {}).filter(Boolean).forEach(t => map.set(t, Math.max(map.get(t) || 0, idx + 1)));
        });
        // final and champion
        Object.values(br.final || {}).filter(Boolean).forEach(t => map.set(t, Math.max(map.get(t) || 0, 5)));
        const champ = br.final?.fin || null;
        if (champ) map.set(champ, 6);
        // group stage picks don't add progression here
      } else {
        const s = pred || {};
        if (s.top1) map.set(s.top1, 6);
        if (s.top2) map.set(s.top2, 5);
        if (s.top3) map.set(s.top3, 4);
        if (s.top4) map.set(s.top4, 4);
      }
    } catch (err) { }
    return map;
  }

  // Aggregate counts per stage for each team
  const teamStageCounts = useMemo(() => {
    const out = new Map();
    entries.forEach(e => {
      const mode = e.mode || 'simple';
      const pred = mode === 'advanced' ? e.prediction : (e.prediction || {});
      const tmap = teamStagesFromPrediction(pred, mode);
      // for teams not present in tmap, leave as stage 0 (unknown/Group)
      allTeams.forEach(team => {
        const st = tmap.has(team) ? tmap.get(team) : 0;
        if (!out.has(team)) out.set(team, new Array(STAGES.length + 1).fill(0));
        const arr = out.get(team);
        arr[st] = (arr[st] || 0) + 1;
      });
    });
    return out;
  }, [entries, allTeams]);

  // Compute controversial teams: high disagreement (1 - max share)
  const controversialTeams = useMemo(() => {
    const out = [];
    teamStageCounts.forEach((arr, team) => {
      const totalForTeam = arr.reduce((a,b)=>a+b,0) || 1;
      const maxShare = Math.max(...arr) / totalForTeam;
      const score = 1 - maxShare; // higher = more disagreement
      out.push({ team, score, total: totalForTeam, counts: arr });
    });
    return out.sort((a,b) => b.score - a.score);
  }, [teamStageCounts]);

  // Export CSV for selected team's distribution
  function exportSelectedCSV(team) {
    if (!team) return;
    const arr = teamStageCounts.get(team) || new Array(STAGES.length + 1).fill(0);
    const labels = ['Unknown/Group'].concat(STAGES);
    const rows = [['stage','count','percent']];
    const totalForTeam = arr.reduce((a,b)=>a+b,0) || 1;
    labels.forEach((lab,i)=> rows.push([lab, String(arr[i]||0), String(Math.round((arr[i]||0)/totalForTeam*100))+'%']));
    const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${team.replace(/\s+/g,'_')}_distribution.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

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
                            <div className="hover-reveal" style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                              <div>{team}</div>
                              {renderHoldersPopover(holders)}
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
                  <div className="hover-reveal" style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                    <div>{player}</div>
                    {renderHoldersPopover(holders)}
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
                      <div className="hover-reveal" style={{ flex: 1, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                        <div>{val || 'Ingen valg'}</div>
                        {renderHoldersPopover(holders)}
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
                            <div className="hover-reveal" style={{ flex: 1, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>{t}{renderHoldersPopover(holders)}</div>
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

      <div className="section-card">
        <h3>Analyse: Hvor langt kommer et hold?</h3>
        <p>Vælg et hold for at se hvordan deltagerne fordeler sig på hvor langt holdet går.</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <select value={selectedTeam || ''} onChange={e => setSelectedTeam(e.target.value || null)} style={{ padding: '6px 8px' }}>
            <option value="">-- vælg hold --</option>
            {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ color: '#94a3b8' }}>{total} bud analyseret</div>
          <button onClick={() => exportSelectedCSV(selectedTeam || allTeams[0])} style={{ padding: '6px 10px', background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.04)' }}>Eksport CSV</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Top kontroversielle hold:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {controversialTeams.slice(0,6).map(ct => {
              const arr = ct.counts || new Array(STAGES.length+1).fill(0);
              const total = arr.reduce((a,b)=>a+b,0) || 1;
              const max = Math.max(...arr);
              return (
                <button key={ct.team} onClick={() => setSelectedTeam(ct.team)} title={`${ct.team} — uenig score ${ct.score.toFixed(2)}`} style={{ padding: '6px 8px', background: '#0b1220', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, textAlign: 'left', fontSize: 13 }}>{ct.team}</div>
                  <div style={{ width: 80, background: 'rgba(255,255,255,0.04)', height: 10, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((max/total)*100)}%`, height: 10, background: '#f59e0b' }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {(() => {
          const current = selectedTeam || allTeams[0] || null;
          if (!current) return <div>Ingen hold tilgængeligt.</div>;
          const counts = teamStageCounts.get(current) || new Array(STAGES.length + 1).fill(0);
          const labels = ['Ingen/Group'].concat(STAGES);
          const dataset = counts.map((c,i) => c);
          const colors = ['#64748b','#c084fc','#60a5fa','#34d399','#f59e0b','#fb7185','#ef4444','#7c3aed'];
          const topIdx = dataset.reduce((mi, v, i) => v > (dataset[mi] || 0) ? i : mi, 0);
          const totalForTeam = dataset.reduce((a,b)=>a+b,0) || 1;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12, alignItems: 'start' }}>
              <div>
                <div style={{ height: 240 }}>
                  <Bar data={{ labels, datasets: [{ label: 'Antal', data: dataset, backgroundColor: labels.map((_,i)=>colors[i % colors.length]) }] }} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed} (${Math.round((ctx.parsed/totalForTeam)*100)}%)` } } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }} />
                </div>
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{current}</div>
                <div style={{ marginBottom: 8 }}>Mest sandsynligt: <strong>{labels[topIdx]}</strong> ({Math.round((dataset[topIdx]/totalForTeam)*100)}%)</div>
                <div style={{ marginBottom: 8 }}>Unikhed (antal forskellige scenarier): <strong>{dataset.filter(x=>x>0).length}</strong></div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Tal</div>
                  <ul style={{ paddingLeft: 16 }}>
                    {labels.map((lab, i) => (
                      <li key={lab} style={{ marginBottom: 6 }}>{lab}: {dataset[i]} ({pct(dataset[i], totalForTeam)})</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}
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
                  <div style={{ color: '#cbd5e1', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>Kun {it.count} forudsigelser havde dette; <span className="hover-reveal" style={{ position: 'relative' }}>{renderHoldersPopover(it.holders)}</span></div>
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
