import { FLAG_CODES, ALL_TEAMS, FUN_QUESTIONS } from '../data/wc2026.js';

export function FlagSpan({ team }) {
  const code = FLAG_CODES[team];
  if (!code) return null;
  return <span className={`fi fi-${code}`} style={{ marginRight: 6 }} />;
}

export function TeamSelect({ value, onChange, label, placeholder = '– Vælg hold –' }) {
  return (
    <div className="field-row">
      {label && <label>{label}</label>}
      <div className="select-wrap">
        {value && <FlagSpan team={value} />}
        <select value={value || ''} onChange={e => onChange(e.target.value || null)}>
          <option value="">{placeholder}</option>
          {ALL_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}

export function FunQuestionSelect({ qid, value, onChange }) {
  const q = FUN_QUESTIONS.find(x => x.id === qid);
  if (!q) return null;
  return (
    <div className="field-row">
      <label>{q.title}</label>
      <div className="select-wrap">
        <select value={value || ''} onChange={e => onChange(e.target.value || null)}>
          <option value="">– Vælg –</option>
          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );
}
