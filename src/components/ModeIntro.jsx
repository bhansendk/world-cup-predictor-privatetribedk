const modeConfig = {
  simple: {
    icon: 'Simple',
    title: 'Hurtig mode',
    subtitle: 'Kort version med de vigtigste bud',
    bullets: [
      'Vælg top 4: mester, runner-up, nr. 3 og nr. 4',
      'Svar på 4 centrale sjove tips',
      'Hurtig at udfylde og god til alle'
    ],
    cta: 'Start Hurtig mode',
    accentClass: 'mode-intro-simple'
  },
  advanced: {
    icon: 'Advanced',
    title: 'Fodboldinteresseret',
    subtitle: 'Fuld version for dig der vil gå i dybden',
    bullets: [
      "Udfyld alle grupper og vælg 8 bedste 3'ere",
      'Forudsig hele bracketen fra R32 til finale og bronze',
      'Svar på alle 10 sjove tips for maksimal score'
    ],
    cta: 'Start Fodboldinteresseret',
    accentClass: 'mode-intro-advanced'
  }
};

export default function ModeIntro({ mode, onStart, onBack }) {
  const cfg = modeConfig[mode] || modeConfig.simple;

  return (
    <div className="mode-intro-page">
      <div className={`mode-intro-card ${cfg.accentClass}`}>
        <div className="mode-intro-icon">{cfg.icon}</div>
        <h1>{cfg.title}</h1>
        <p className="mode-intro-subtitle">{cfg.subtitle}</p>
        <p className="mode-intro-body">
          Konkurrencen lukker ved VM-kickoff, og du skal udfylde alle felter i den valgte mode for at kunne indsende.
        </p>
        <ul className="mode-intro-list">
          {cfg.bullets.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mode-intro-actions">
          <button className="btn-primary" onClick={onStart}>{cfg.cta}</button>
          <button className="btn-ghost" onClick={onBack}>Tilbage til modevalg</button>
        </div>
      </div>
    </div>
  );
}
