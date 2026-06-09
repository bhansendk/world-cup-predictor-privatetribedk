// ── All VM 2026 game data ─────────────────────────────────────────

export const GROUPS = {
  A: {name:'Gruppe A', teams:['Mexico','South Africa','South Korea','Czech Republic'], flags:['🇲🇽','🇿🇦','🇰🇷','🇨🇿']},
  B: {name:'Gruppe B', teams:['Canada','Bosnia & Herz.','Qatar','Switzerland'], flags:['🇨🇦','🇧🇦','🇶🇦','🇨🇭']},
  C: {name:'Gruppe C', teams:['Brazil','Morocco','Haiti','Scotland'], flags:['🇧🇷','🇲🇦','🇭🇹','🏴󠁧󠁢󠁳󠁣󠁴󠁿']},
  D: {name:'Gruppe D', teams:['USA','Paraguay','Australia','Turkey'], flags:['🇺🇸','🇵🇾','🇦🇺','🇹🇷']},
  E: {name:'Gruppe E', teams:['Germany','Curaçao','Ivory Coast','Ecuador'], flags:['🇩🇪','🇨🇼','🇨🇮','🇪🇨']},
  F: {name:'Gruppe F', teams:['Netherlands','Japan','Sweden','Tunisia'], flags:['🇳🇱','🇯🇵','🇸🇪','🇹🇳']},
  G: {name:'Gruppe G', teams:['Belgium','Egypt','Iran','New Zealand'], flags:['🇧🇪','🇪🇬','🇮🇷','🇳🇿']},
  H: {name:'Gruppe H', teams:['Spain','Cape Verde','Saudi Arabia','Uruguay'], flags:['🇪🇸','🇨🇻','🇸🇦','🇺🇾']},
  I: {name:'Gruppe I', teams:['France','Senegal','Iraq','Norway'], flags:['🇫🇷','🇸🇳','🇮🇶','🇳🇴']},
  J: {name:'Gruppe J', teams:['Argentina','Algeria','Austria','Jordan'], flags:['🇦🇷','🇩🇿','🇦🇹','🇯🇴']},
  K: {name:'Gruppe K', teams:['Portugal','DR Congo','Uzbekistan','Colombia'], flags:['🇵🇹','🇨🇩','🇺🇿','🇨🇴']},
  L: {name:'Gruppe L', teams:['England','Croatia','Ghana','Panama'], flags:['🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇭🇷','🇬🇭','🇵🇦']}
};

export const FLAG_CODES = {
  'Mexico':'mx','South Africa':'za','South Korea':'kr','Czech Republic':'cz',
  'Canada':'ca','Bosnia & Herz.':'ba','Qatar':'qa','Switzerland':'ch',
  'Brazil':'br','Morocco':'ma','Haiti':'ht','Scotland':'gb-sct',
  'USA':'us','Paraguay':'py','Australia':'au','Turkey':'tr',
  'Germany':'de','Curaçao':'cw','Ivory Coast':'ci','Ecuador':'ec',
  'Netherlands':'nl','Japan':'jp','Sweden':'se','Tunisia':'tn',
  'Belgium':'be','Egypt':'eg','Iran':'ir','New Zealand':'nz',
  'Spain':'es','Cape Verde':'cv','Saudi Arabia':'sa','Uruguay':'uy',
  'France':'fr','Senegal':'sn','Iraq':'iq','Norway':'no',
  'Argentina':'ar','Algeria':'dz','Austria':'at','Jordan':'jo',
  'Portugal':'pt','DR Congo':'cd','Uzbekistan':'uz','Colombia':'co',
  'England':'gb-eng','Croatia':'hr','Ghana':'gh','Panama':'pa'
};

export const ALL_TEAMS = Object.values(GROUPS).flatMap(g => g.teams).sort();

export function flagImg(team) {
  const code = FLAG_CODES[team];
  if (!code) return '';
  return `<span class="fi fi-${code}"></span>`;
}

// Official FIFA 2026 R32 bracket (3c = third-place team, index into COMBO slot)
// Left half (→ SF1): QF_A (m1-m4: 1E,1I,2A/2B,1F) + QF_B (m9-m12: 2K/2L,1H,1D,1G)
// Right half (→ SF2): QF_C (m5-m8: 1C,2E/2I,1A,1L) + QF_D (m13-m16: 1J,2D/2G,1B,1K)
export const R32 = [
  {id:'m1',  a:['1','E'], b:['3c',3]},
  {id:'m2',  a:['1','I'], b:['3c',5]},
  {id:'m3',  a:['2','A'], b:['2','B']},
  {id:'m4',  a:['1','F'], b:['2','C']},
  {id:'m9',  a:['2','K'], b:['2','L']},
  {id:'m10', a:['1','H'], b:['2','J']},
  {id:'m11', a:['1','D'], b:['3c',2]},
  {id:'m12', a:['1','G'], b:['3c',4]},
  {id:'m5',  a:['1','C'], b:['2','F']},
  {id:'m6',  a:['2','E'], b:['2','I']},
  {id:'m7',  a:['1','A'], b:['3c',0]},
  {id:'m8',  a:['1','L'], b:['3c',7]},
  {id:'m13', a:['1','J'], b:['2','H']},
  {id:'m14', a:['2','D'], b:['2','G']},
  {id:'m15', a:['1','B'], b:['3c',1]},
  {id:'m16', a:['1','K'], b:['3c',6]}
];
export const R16_PAIRS = [[0,1],[2,3],[4,5],[6,7],[8,9],[10,11],[12,13],[14,15]];
export const QF_PAIRS  = [[0,1],[2,3],[4,5],[6,7]];
export const SF_PAIRS  = [[0,1],[2,3]];

export const SIMPLE_SHARED = ['topscorer','golden_ball','most_yellow','most_goals_team'];

export const FUN_PTS = {
  topscorer: 10, golden_ball: 10, golden_glove: 8, most_assist: 6,
  most_goals_match: 4, total_goals: 4,
  most_yellow: 6, most_red: 6, own_goals: 3, most_goals_team: 8
};

export const FUN_QUESTIONS = [
  {
    id: 'topscorer',
    title: '⚽ Topscorer (Guldstøvlen)',
    desc: 'Hvem scorer flest mål? Rangeret efter Bet365 odds.',
    type: 'select',
    options: [
      'Kylian Mbappé (France)','Harry Kane (England)','Lionel Messi (Argentina)',
      'Erling Haaland (Norway)','Mikel Oyarzabal (Spain)','Lamine Yamal (Spain)',
      'Cristiano Ronaldo (Portugal)','Ousmane Dembélé (France)','Lautaro Martinez (Argentina)',
      'Vinicius Jr (Brazil)','Raphinha (Brazil)','Bukayo Saka (England)',
      'Igor Thiago (Brazil)','Julian Alvarez (Argentina)','Kai Havertz (Germany)',
      'Luis Suarez (Colombia)','Mikel Merino (Spain)','Nick Woltemade (Germany)',
      'Ollie Watkins (England)','Romelu Lukaku (Belgium)','Bruno Fernandes (Portugal)',
      'Cody Gakpo (Netherlands)','Ferran Torres (Spain)','Florian Wirtz (Germany)',
      'Jude Bellingham (England)','Michael Olise (France)','Neymar Jr (Brazil)',
      'Anden spiller'
    ]
  },
  {
    id: 'golden_ball',
    title: '🌟 Gyldne Bold',
    desc: 'Hvem vinder prisen som bedste spiller? Rangeret efter Bet365 odds – kun under 50/1.',
    type: 'select',
    options: [
      'Harry Kane (England)','Lamine Yamal (Spain)','Kylian Mbappé (France)',
      'Lionel Messi (Argentina)','Michael Olise (France)','Vinicius Jr (Brazil)',
      'Bruno Fernandes (Portugal)','Declan Rice (England)','Rayan Cherki (France)',
      'Jude Bellingham (England)','Mikel Oyarzabal (Spain)','Ousmane Dembélé (France)',
      'Pedri (Spain)','Raphinha (Brazil)','Rodri (Spain)','Vitinha (Portugal)',
      'Erling Haaland (Norway)','Bernardo Silva (Portugal)','Cristiano Ronaldo (Portugal)',
      'Fabian Ruiz (Spain)','Neymar Jr (Brazil)','Désiré Doué (France)',
      'Jeremy Doku (Belgium)','Julian Alvarez (Argentina)','Jamal Musiala (Germany)',
      'Anden spiller'
    ]
  },
  {
    id: 'golden_glove',
    title: '🧤 Gyldne Handske',
    desc: 'Hvem vinder prisen som bedste målmand? Rangeret efter Bet365 odds.',
    type: 'select',
    options: [
      'Emiliano Martínez (Argentina)','Unai Simón (Spain)','Alisson Becker (Brazil)',
      'Ederson (Brazil)','Mike Maignan (France)','David Raya (Spain)',
      'Jordan Pickford (England)','Diogo Costa (Portugal)','Manuel Neuer (Germany)',
      'Bart Verbruggen (Netherlands)','Joan Garcia (Spain)','Oliver Baumann (Germany)',
      'Thibaut Courtois (Belgium)','Senne Lammens (Belgium)','Ørjan Nyland (Norway)',
      'Matt Freese (USA)','Anden keeper'
    ]
  },
  {
    id: 'most_assist',
    title: '🎯 Flest assists',
    desc: 'Hvem leverer flest assists i turneringen? Rangeret efter Bet365 odds.',
    type: 'select',
    options: [
      'Bruno Fernandes (Portugal)','Michael Olise (France)','Lamine Yamal (Spain)',
      'Lionel Messi (Argentina)','Jeremy Doku (Belgium)','Vinicius Jr (Brazil)',
      'Florian Wirtz (Germany)','Kevin De Bruyne (Belgium)','Kylian Mbappé (France)',
      'Nico Williams (Spain)','Raphinha (Brazil)','Rayan Cherki (France)',
      'Bukayo Saka (England)','Mikel Oyarzabal (Spain)','Ousmane Dembélé (France)',
      'Dani Olmo (Spain)','Declan Rice (England)','Fabian Ruiz (Spain)',
      'Jamal Musiala (Germany)','Pedri (Spain)','Ferran Torres (Spain)',
      'Jude Bellingham (England)','Julian Alvarez (Argentina)','Leroy Sané (Germany)',
      'Matheus Cunha (Brazil)','Morgan Rogers (England)','Neymar Jr (Brazil)',
      'Bernardo Silva (Portugal)','Bradley Barcola (France)','Désiré Doué (France)',
      'Harry Kane (England)','Joshua Kimmich (Germany)','Julian Ryerson (Norway)',
      'Kai Havertz (Germany)','Luiz Henrique (Brazil)','Marcus Rashford (England)',
      'Nuno Mendes (Portugal)','Alex Baena (Spain)','Anthony Gordon (England)',
      'Anden spiller'
    ]
  },
  {
    id: 'most_goals_match',
    title: '💥 Flest mål i én kamp',
    desc: 'Hvad bliver det samlede målantal i den kamp med flest mål?',
    type: 'select',
    options: ['2 mål eller færre','3 mål','4 mål','5 mål ⭐ Favorit','6 mål ⭐ Favorit','7 mål','8 mål','9 mål','10+ mål']
  },
  {
    id: 'total_goals',
    title: '📊 Totalt antal mål i turneringen',
    desc: 'VM 2026 har 104 kampe. Odds peger på ca. 2,6–2,8 mål/kamp ≈ 270–290 mål i alt.',
    type: 'select',
    options: [
      'Under 240 mål (under 2,3/kamp)',
      '240–259 mål (2,3–2,5/kamp)',
      '260–279 mål (2,5–2,7/kamp) ⭐ Favorit',
      '280–299 mål (2,7–2,9/kamp) ⭐ Favorit',
      '300–319 mål (2,9–3,1/kamp)',
      '320+ mål (over 3,1/kamp – historisk højt)'
    ]
  },
  {
    id: 'most_yellow',
    title: '🟨 Flest gule kort – hold',
    desc: 'Hvilket hold samler flest gule kort i hele turneringen?',
    type: 'select',
    options: ALL_TEAMS
  },
  {
    id: 'most_red',
    title: '🟥 Flest røde kort – hold',
    desc: 'Hvilket hold får flest røde kort i hele turneringen?',
    type: 'select',
    options: ALL_TEAMS
  },
  {
    id: 'own_goals',
    title: '🙈 Antal selvmål',
    desc: 'Hvor mange selvmål scores der i hele turneringen? VM 2018 (64 kampe): 12. VM 2022 (64 kampe): 6. VM 2026 har 104 kampe.',
    type: 'select',
    options: [
      '0–3 selvmål (usandsynligt lavt)','4–5 selvmål',
      '6–7 selvmål ⭐ Favorit','8–9 selvmål ⭐ Favorit',
      '10–11 selvmål','12–13 selvmål','14–15 selvmål','16+ selvmål (historisk højt)'
    ]
  },
  {
    id: 'most_goals_team',
    title: '🎯 Flest mål – hold',
    desc: 'Hvilket hold scorer flest mål i hele turneringen?',
    type: 'select',
    options: ALL_TEAMS
  },
];
