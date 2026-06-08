import { FUN_QUESTIONS, FUN_PTS } from '../../data/wc2026.js';
import { FlagSpan } from '../FormFields.jsx';

export default function FunTipsTab({ FUN, updateFun }) {
  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>🎯 Sjove tips</h2>
        <p>Gæt rigtigt og hent ekstra point!</p>
      </div>
      <div className="fun-grid">
        {FUN_QUESTIONS.map(q => (
          <div key={q.id} className="fun-card">
            <div className="fun-card-header">
              <span className="fun-title">{q.title}</span>
              <span className="fun-pts">+{FUN_PTS[q.id]} pt</span>
            </div>
            <p className="fun-desc">{q.desc}</p>
            <div className="select-wrap">
              <select
                value={FUN[q.id] || ''}
                onChange={e => updateFun(q.id, e.target.value || null)}
              >
                <option value="">– Vælg –</option>
                {q.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
