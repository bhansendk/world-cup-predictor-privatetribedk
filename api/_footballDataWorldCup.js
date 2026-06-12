function normalizeTeamName(team) {
  return String(team || '').trim();
}

function normalizeStage(stage, group) {
  const raw = `${stage || ''} ${group || ''}`.toUpperCase();
  if (raw.includes('ROUND OF 32') || raw.includes('LAST_32') || raw.includes('ROUND_OF_32')) return 'r32';
  if (raw.includes('ROUND OF 16') || raw.includes('LAST_16') || raw.includes('ROUND_OF_16')) return 'r16';
  if (raw.includes('QUARTER')) return 'qf';
  if (raw.includes('SEMI')) return 'sf';
  if (raw.includes('THIRD')) return 'bronze';
  if (raw.includes('FINAL')) return 'final';
  return null;
}

function extractGroupKey(groupLabel) {
  const label = String(groupLabel || '').toUpperCase();
  const match = label.match(/GROUP[_\s-]*([A-L])/i);
  return match ? match[1].toUpperCase() : null;
}

function sortThirdCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    if ((b.goalDifference || 0) !== (a.goalDifference || 0)) return (b.goalDifference || 0) - (a.goalDifference || 0);
    if ((b.goalsFor || 0) !== (a.goalsFor || 0)) return (b.goalsFor || 0) - (a.goalsFor || 0);
    return String(a.groupKey || '').localeCompare(String(b.groupKey || ''));
  });
}

function pickWinnerFromMatch(match) {
  const home = normalizeTeamName(match?.homeTeam?.name);
  const away = normalizeTeamName(match?.awayTeam?.name);
  const fullTime = match?.score?.fullTime || {};
  const homeGoals = Number.isFinite(fullTime.home) ? fullTime.home : Number(match?.score?.fullTime?.homeTeam ?? match?.score?.fullTime?.home ?? 0);
  const awayGoals = Number.isFinite(fullTime.away) ? fullTime.away : Number(match?.score?.fullTime?.awayTeam ?? match?.score?.fullTime?.away ?? 0);
  const winner = String(match?.score?.winner || '').toUpperCase();

  if (winner === 'HOME_TEAM') return home || null;
  if (winner === 'AWAY_TEAM') return away || null;
  if (homeGoals > awayGoals) return home || null;
  if (awayGoals > homeGoals) return away || null;
  return null;
}

function toNumeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function bumpCounter(store, key, delta = 1) {
  if (!key) return;
  store[key] = (store[key] || 0) + delta;
}

function topKeyByCount(store) {
  return Object.entries(store || {}).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  })[0]?.[0] || null;
}

function stageOrderKey(match) {
  return new Date(match?.utcDate || match?.date || 0).getTime() || 0;
}

export function createImportedResultsFromFootballData(payload, existingResults = {}) {
  const imported = {
    g: {},
    third: [],
    r32: {},
    r16: {},
    qf: {},
    sf: {},
    final: {},
    bronze: {},
    fun: {}
  };

  const standings = Array.isArray(payload?.standings?.standings) ? payload.standings.standings : [];
  const thirdCandidates = [];

  standings
    .filter(block => String(block?.type || '').toUpperCase() === 'TOTAL' && extractGroupKey(block?.group))
    .forEach(block => {
      const groupKey = extractGroupKey(block.group);
      const table = Array.isArray(block?.table) ? [...block.table].sort((a, b) => toNumeric(a.position) - toNumeric(b.position)) : [];
      const p1 = normalizeTeamName(table.find(row => toNumeric(row.position) === 1)?.team?.name || '');
      const p2 = normalizeTeamName(table.find(row => toNumeric(row.position) === 2)?.team?.name || '');
      const thirdRow = table.find(row => toNumeric(row.position) === 3) || null;
      const p3 = normalizeTeamName(thirdRow?.team?.name || '');

      if (groupKey) {
        imported.g[groupKey] = {
          p1: p1 || null,
          p2: p2 || null,
          p3: p3 || null
        };
      }

      if (groupKey && thirdRow && p3) {
        thirdCandidates.push({
          groupKey,
          team: p3,
          points: toNumeric(thirdRow.points),
          goalDifference: toNumeric(thirdRow.goalDifference),
          goalsFor: toNumeric(thirdRow.goalsFor)
        });
      }
    });

  imported.third = sortThirdCandidates(thirdCandidates).slice(0, 8).map(row => row.groupKey);

  const finishedMatches = Array.isArray(payload?.matches?.matches)
    ? payload.matches.matches.filter(match => String(match?.status || '').toUpperCase() === 'FINISHED')
    : [];

  const goalsByTeam = {};
  const assistsByPlayer = {};
  const yellowByTeam = {};
  const redByTeam = {};
  let mostGoalsMatch = null;
  let maxGoalsInOneMatch = -1;
  let ownGoals = 0;
  let totalGoals = 0;

  const rounds = { r32: [], r16: [], qf: [], sf: [], final: [], bronze: [] };

  for (const match of finishedMatches) {
    const home = normalizeTeamName(match?.homeTeam?.name);
    const away = normalizeTeamName(match?.awayTeam?.name);
    const score = match?.score || {};
    const fullTime = score?.fullTime || {};
    const homeGoals = toNumeric(fullTime.home ?? fullTime.homeTeam);
    const awayGoals = toNumeric(fullTime.away ?? fullTime.awayTeam);
    const matchGoals = homeGoals + awayGoals;
    totalGoals += matchGoals;

    if (home) bumpCounter(goalsByTeam, home, homeGoals);
    if (away) bumpCounter(goalsByTeam, away, awayGoals);

    if (matchGoals > maxGoalsInOneMatch) {
      maxGoalsInOneMatch = matchGoals;
      mostGoalsMatch = String(matchGoals);
    }

    for (const goal of match?.goals || []) {
      const assist = String(goal?.assist?.name || '').trim();
      const type = String(goal?.type || '').toUpperCase();
      if (assist) bumpCounter(assistsByPlayer, assist, 1);
      if (type.includes('OWN')) ownGoals += 1;
    }

    for (const booking of match?.bookings || []) {
      const team = normalizeTeamName(booking?.team?.name);
      const card = String(booking?.card || '').toUpperCase();
      if (card.includes('YELLOW')) bumpCounter(yellowByTeam, team, 1);
      if (card.includes('RED')) bumpCounter(redByTeam, team, 1);
    }

    const bucket = normalizeStage(match?.stage, match?.group);
    const winner = pickWinnerFromMatch(match);
    if (bucket && winner) {
      rounds[bucket].push({ when: stageOrderKey(match), winner });
    }
  }

  for (const [bucket, matches] of Object.entries(rounds)) {
    matches.sort((a, b) => a.when - b.when);
    if (bucket === 'final') {
      if (matches[0]?.winner) imported.final.fin = matches[0].winner;
      continue;
    }
    if (bucket === 'bronze') {
      if (matches[0]?.winner) imported.bronze.bronze_w = matches[0].winner;
      continue;
    }
    matches.forEach((entry, idx) => {
      const key = bucket === 'r32' ? `m${idx + 1}` : `${bucket}_${idx}`;
      imported[bucket][key] = entry.winner;
    });
  }

  const scorer = payload?.scorers?.scorers?.[0]?.player?.name || payload?.scorers?.scorers?.[0]?.name || null;

  imported.fun = {
    ...(existingResults?.fun || {}),
    ...(scorer ? { topscorer: scorer } : {}),
    ...(topKeyByCount(assistsByPlayer) ? { most_assist: topKeyByCount(assistsByPlayer) } : {}),
    ...(mostGoalsMatch ? { most_goals_match: mostGoalsMatch } : {}),
    ...(topKeyByCount(yellowByTeam) ? { most_yellow: topKeyByCount(yellowByTeam) } : {}),
    ...(topKeyByCount(redByTeam) ? { most_red: topKeyByCount(redByTeam) } : {}),
    ...(topKeyByCount(goalsByTeam) ? { most_goals_team: topKeyByCount(goalsByTeam) } : {}),
    ...(Number.isFinite(totalGoals) ? { total_goals: String(totalGoals) } : {}),
    ...(Number.isFinite(ownGoals) ? { own_goals: String(ownGoals) } : {})
  };

  return imported;
}
