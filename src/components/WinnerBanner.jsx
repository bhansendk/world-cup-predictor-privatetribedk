import { FLAG_CODES } from '../data/wc2026.js';

export default function WinnerBanner({ champ }) {
  if (!champ) return null;
  const code = FLAG_CODES[champ];
  return (
    <div className="winner-banner">
      <span className="winner-trophy">🏆</span>
      {code && <span className={`fi fi-${code} winner-flag`} />}
      <span className="winner-name">{champ}</span>
      <span className="winner-trophy">🏆</span>
    </div>
  );
}
