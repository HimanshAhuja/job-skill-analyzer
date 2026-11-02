/** Horizontal bar for a 0-100 match score (green >= 60, amber >= 30, red below). */
export default function ScoreBar({ value }: { value: number | string | null }) {
  if (value === null || value === undefined) return <span className="muted">–</span>;
  const v = Number(value);
  const tone = v >= 60 ? 'good' : v >= 30 ? 'mid' : 'low';
  return (
    <span className="score">
      <span className="track">
        <span className={`fill ${tone}`} style={{ width: `${Math.max(v, 2)}%` }} />
      </span>
      <b>{v.toFixed(0)}%</b>
    </span>
  );
}
