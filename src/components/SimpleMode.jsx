import { useState } from 'react';
import { TeamSelect, FunQuestionSelect } from './FormFields.jsx';

const SIMPLE_FIELDS = [
  { key: 'top1', label: 'Mester' },
  { key: 'top2', label: 'Runner-up' },
  { key: 'top3', label: 'Nr. 3' },
  { key: 'top4', label: 'Nr. 4' },
  { key: 'topscorer', label: 'Topscorer' },
  { key: 'golden_ball', label: 'Gyldne Bold' },
  { key: 'most_yellow', label: 'Flest gule kort - hold' },
  { key: 'most_goals_team', label: 'Flest mål - hold' }
];

function isFilled(v) {
  if (typeof v === 'string') return v.trim().length > 0;
  return v !== null && v !== undefined;
}

export default function SimpleMode({ SIMPLE, onChange, onFunChange, FUN, serverData, onSubmit, loading, onReset, myName, setMyName }) {
  const [name, setName] = useState(myName || '');
  const [status, setStatus] = useState('');
  const revealTs = serverData?.revealDate ? Date.parse(serverData.revealDate) : Date.parse('2026-06-11T19:00:00Z');
  const registrationClosed = Number.isFinite(revealTs) ? Date.now() >= revealTs : false;
  const missingFields = SIMPLE_FIELDS.filter(f => !isFilled(SIMPLE?.[f.key])).map(f => f.label);
  const isComplete = missingFields.length === 0;

  const handleSubmit = async () => {
    if (registrationClosed) { setStatus('⛔ Tilmelding er lukket. VM er startet.'); return; }
    if (!name.trim()) { setStatus('Skriv dit navn først!'); return; }
    if (!isComplete) {
      setStatus('⚠️ Mangler i Hurtig mode: ' + missingFields.join(', '));
      return;
    }
    const prediction = { ...SIMPLE };
    const res = await onSubmit(name.trim(), 'simple', prediction);
    if (res.ok) {
      setMyName(name.trim());
      setStatus('✅ Forudsigelse gemt!');
    }
    else setStatus('❌ Fejl: ' + res.error);
  };

  const top4 = [
    { key: 'top1', label: '🥇 Mester (15 pt)' },
    { key: 'top2', label: '🥈 Runner-up (10 pt)' },
    { key: 'top3', label: '🥉 Nr. 3 (5 pt)' },
    { key: 'top4', label: '4️⃣ Nr. 4 (5 pt)' },
  ];

  const funShared = [
    { key: 'topscorer', label: '⚽ Topscorer (10 pt)' },
    { key: 'golden_ball', label: '🌟 Gyldne Bold (10 pt)' },
    { key: 'most_yellow', label: '🟨 Flest gule kort – hold (6 pt)' },
    { key: 'most_goals_team', label: '🎯 Flest mål – hold (8 pt)' },
  ];

  return (
    <div className="mode-container">
      <div className="section-card">
        <h2>⚡ Hurtig mode</h2>
        <p className="section-desc">Vælg din top 4 og 4 sjove forudsigelser.</p>
        <div className="form-grid">
          {top4.map(({ key, label }) => (
            <TeamSelect key={key} label={label} value={SIMPLE[key]} onChange={v => onChange(key, v)} />
          ))}
        </div>
      </div>

      <div className="section-card">
        <h2>🎯 Sjove tips</h2>
        <div className="form-grid">
          {funShared.map(({ key, label }) => (
            <FunQuestionSelect key={key} qid={key} value={SIMPLE[key]} onChange={v => onChange(key, v)} />
          ))}
        </div>
      </div>

      <div className="section-card">
        <h2>📘 Pointsystem - Hurtig mode</h2>
        <ul className="points-list">
          <li>Mester korrekt: 15 point</li>
          <li>Runner-up korrekt: 10 point</li>
          <li>Nr. 3 og Nr. 4 korrekt: 5 point hver</li>
          <li>Hold i top 4 men forkert placering: 3 point</li>
          <li>Topscorer (spiller): 10 point</li>
          <li>Gyldne Bold (spiller): 10 point</li>
          <li>Flest gule kort (hold): 6 point</li>
          <li>Flest mål (hold): 8 point</li>
        </ul>
      </div>

      <div className="section-card">
        <h2>📤 Send din forudsigelse</h2>
        <div className="submit-row">
          <input
            type="text"
            className="name-input"
            placeholder="Dit navn"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button className="btn-primary" onClick={handleSubmit} disabled={loading || registrationClosed}>
            {loading ? 'Sender…' : registrationClosed ? 'Tilmelding lukket' : 'Send forudsigelse ✈️'}
          </button>
          <button className="btn-ghost btn-sm" onClick={onReset}>🗑️ Nulstil alt</button>
        </div>
        {registrationClosed && <p className="info-txt">⛔ Tilmelding er lukket fra 11. juni 2026 kl. 21:00 dansk tid.</p>}
        {!registrationClosed && !isComplete && <p className="info-txt">Manglende felter: {missingFields.join(', ')}.</p>}
        {status && <p className="status-msg">{status}</p>}
      </div>

      {serverData?.colleagues?.length > 0 && (
        <div className="section-card">
          <h2>👥 Indsendte forudsigelser</h2>
          <div className="participants-list">
            {serverData.colleagues.map(c => (
              <div key={c.name} className="participant-chip">
                {c.name} <span className="chip-mode">{c.mode === 'simple' ? '⚡' : '⭐'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
