import { calcScore, calcSimpleScore } from '../../lib/scoring.js';

export default function StatistikTab({ serverData }) {
  const colleagues = serverData?.colleagues || [];
  const results = serverData?.results || {};

  const stats = colleagues.map(c => {
    const prediction = c.prediction;
    const mode = c.mode;

    let score = 0;
    if (mode === 'simple') {
      score = calcSimpleScore(prediction, results);
    } else {
      score = calcScore(prediction, results);
    }

    return {
      name: c.name,
      score,
      prediction
    };
  });

  const sorted = [...stats].sort((a, b) => b.score - a.score);

  const top1Counts = {};
  stats.forEach(s => {
    const t = s.prediction?.top1;
    if (t) top1Counts[t] = (top1Counts[t] || 0) + 1;
  });

  const top1Sorted = Object.entries(top1Counts)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="section-card">
      <h2>📊 Statistik</h2>

      <h3>🏆 Bedst performende</h3>
      {sorted.map(s => (
        <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{s.name}</strong>
          <span>{s.score} point</span>
        </div>
      ))}

      <h3>🔥 Mest populære vinder</h3>
      {top1Sorted.map(([team, count]) => (
        <div key={team} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>{team}</strong>
          <span>{count}</span>
        </div>
      ))}
    </div>
  );
}
