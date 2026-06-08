export default function ModeSelector({ onSelect }) {
  return (
    <div className="mode-selector">
      <div className="mode-hero">
        <div className="mode-hero-icon">⚽</div>
        <h1>VM 2026 Forudsigelse</h1>
        <p>Tirsdagsklubben</p>
        <p className="mode-compare">
          Hurtig mode er den korte version med top 4 og få svar. Fodboldinteresseret er den fulde version med grupper,
          bracket og alle sjove tips.
        </p>
      </div>
      <div className="mode-cards">
        <div className="mode-card mode-card-simple" onClick={() => onSelect('simple')}>
          <div className="mode-card-icon">⚡</div>
          <h2>Hurtig mode</h2>
          <p>Vælg din top 4 og 4 sjove tips.<br/>Perfekt til dem der vil holde det simpelt.</p>
          <ul>
            <li>Mester (15 pt)</li>
            <li>Runner-up (10 pt)</li>
            <li>Nr. 3 &amp; 4 (5 pt)</li>
            <li>Topscorer, Gyldne Bold, m.fl.</li>
          </ul>
          <button className="btn-primary btn-lg">Vælg Hurtig ⚡</button>
        </div>
        <div className="mode-card mode-card-advanced" onClick={() => onSelect('advanced')}>
          <div className="mode-card-icon">⭐</div>
          <h2>Fodboldinteresseret</h2>
          <p>Forudsig hele bracketen fra grupperunde til finale.<br/>For de sande fodboldfans!</p>
          <ul>
            <li>Grupperunde (2–4 pt)</li>
            <li>Knockout-runder (2–15 pt)</li>
            <li>10 sjove spørgsmål</li>
            <li>Mange point på spil!</li>
          </ul>
          <button className="btn-accent btn-lg">Vælg Fodboldinteresseret ⭐</button>
        </div>
      </div>
    </div>
  );
}
