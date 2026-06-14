import { GROUPS } from '../../data/wc2026.js';
import { FlagSpan } from '../FormFields.jsx';

function GroupCard({ groupKey, group, gs, onPick, isLocked = false }) {
  const ranks = [gs.p1 || null, gs.p2 || null, gs.p3 || null];
  const filled = ranks.filter(Boolean).length;

  const clickTeam = (team) => {
    if (isLocked) return;
    const idx = ranks.indexOf(team);
    if (idx >= 0) {
      // deselect
      const newRanks = [...ranks];
      newRanks[idx] = null;
      const compact = newRanks.filter(Boolean);
      onPick(groupKey, { p1: compact[0]||null, p2: compact[1]||null, p3: compact[2]||null });
    } else if (filled < 3) {
      const newRanks = [...ranks];
      const slot = newRanks.findIndex(r => !r);
      newRanks[slot] = team;
      onPick(groupKey, { p1: newRanks[0]||null, p2: newRanks[1]||null, p3: newRanks[2]||null });
    } else {
      // Group full — replace p3 directly
      onPick(groupKey, { p1: ranks[0], p2: ranks[1], p3: team });
    }
  };

  return (
    <div className="group-card">
      <div className="group-title">{group.name}</div>
      <div className="group-progress">{filled}/3 valgt</div>
      <div className="team-list">
        {group.teams.map((team, i) => {
          const rank = ranks.indexOf(team);
          let cls = 'team-item';
          let badge = '';
          if (rank === 0)    { cls += ' s1'; badge = ' 🥇'; }
          else if (rank === 1) { cls += ' s2'; badge = ' 🥈'; }
          else if (rank === 2) { cls += ' s3'; badge = ' 🥉'; }
          else if (filled >= 3 && isLocked) cls += ' dimmed';
          return (
            <div key={team} className={cls} onClick={() => clickTeam(team)}>
              <FlagSpan team={team} />{team}{badge}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function GroupsTab({ S, updateGroup, onRandomFillAll, onResetGroups, onResetAll, isLocked = false }) {
  const handlePick = (gKey, ranks) => {
    if (isLocked) return;
    Object.entries(ranks).forEach(([field, val]) => updateGroup(gKey, field, val));
  };

  const allFilled = Object.keys(GROUPS).every(k => {
    const g = S.g[k] || {};
    return g.p1 && g.p2 && g.p3;
  });

  return (
    <div className="tab-content">
      <div className="section-header">
        <h2>🏟️ Grupperunde</h2>
        <p>Klik på et hold for at rangere dem 1., 2. og 3. i gruppen. Point for videre hold: 1'er = 4, 2'er = 3, 3'er = 2, minus 1 point pr. forkert placering.</p>
        <div className="submit-row" style={{ marginTop: 12 }}>
            <button className="btn-accent btn-sm" onClick={() => onRandomFillAll?.()}>🎲 Udfyld alt tilfældigt</button>
            <button className="btn-ghost btn-sm" onClick={() => onResetGroups?.()}>🧹 Nulstil grupper</button>
            <button className="btn-ghost btn-sm" onClick={() => onResetAll?.()}>🗑️ Nulstil alt</button>
        </div>
        {allFilled && <div className="success-banner">✅ Alle grupper er udfyldt! Gå videre til 3'erne.</div>}
      </div>
      <div className="groups-grid">
        {Object.entries(GROUPS).map(([key, group]) => (
          <GroupCard
            key={key}
            groupKey={key}
            group={group}
            gs={S.g[key] || {}}
            onPick={handlePick}
            isLocked={isLocked}
          />
        ))}
      </div>
    </div>
  );
}
