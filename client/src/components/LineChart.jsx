import { useEffect, useRef, useState } from 'react';
import { formatDate } from '../api.js';

const HEIGHT = 280;
const PAD = { top: 16, right: 132, bottom: 32, left: 44 };
const PAD_NARROW = { top: 16, right: 16, bottom: 32, left: 40 };
const Y_TICKS = [0, 25, 50, 75, 100];

function useWidth(ref) {
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// Spread end labels so they never overlap (min 16px apart), keeping order.
function spreadLabels(items, minGap, top, bottom) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].y - sorted[i - 1].y < minGap) sorted[i].y = sorted[i - 1].y + minGap;
  }
  const overflow = sorted.length ? sorted[sorted.length - 1].y - bottom : 0;
  if (overflow > 0) sorted.forEach((s) => (s.y -= overflow));
  sorted.forEach((s) => (s.y = Math.max(top, s.y)));
  return sorted;
}

/**
 * Multi-series percentage line chart.
 * series: [{ key, label, color, values: number[], dashed? }]
 */
export default function LineChart({ weeks, series, title }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);

  const narrow = width < 520;
  const pad = narrow ? PAD_NARROW : PAD;
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = HEIGHT - pad.top - pad.bottom;
  const x = (i) => pad.left + (weeks.length > 1 ? (i / (weeks.length - 1)) * innerW : innerW / 2);
  const y = (v) => pad.top + innerH - (v / 100) * innerH;
  const last = weeks.length - 1;

  const endLabels = narrow
    ? []
    : spreadLabels(
        series.map((s) => ({ key: s.key, label: s.label, value: s.values[last], color: s.color, y: y(s.values[last]) })),
        16,
        pad.top,
        pad.top + innerH
      );

  function onMove(clientX, el) {
    const px = clientX - el.getBoundingClientRect().left;
    const step = weeks.length > 1 ? innerW / (weeks.length - 1) : innerW;
    const i = Math.round((px - pad.left) / step);
    setHover(Math.min(last, Math.max(0, i)));
  }

  const tooltipLeft = hover === null ? 0 : Math.min(Math.max(x(hover) + 12, 0), width - 190);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <div className="legend" aria-hidden="true">
        {series.map((s) => (
          <span className="legend-item" key={s.key}>
            <span className={`swatch ${s.dashed ? 'dashed' : ''}`} style={s.dashed ? undefined : { background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        className="chart-svg"
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${title}. A table with the same data follows.`}
        onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => e.touches[0] && onMove(e.touches[0].clientX, e.currentTarget)}
      >
        {Y_TICKS.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke="#e6eae8" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="12" fill="#4b5754">
              {t}%
            </text>
          </g>
        ))}
        {weeks.map((w, i) =>
          narrow && i % 2 !== last % 2 ? null : (
            <text key={w} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="12" fill="#4b5754">
              {formatDate(w)}
            </text>
          )
        )}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="#9aa5a1" strokeWidth="1" />
        )}

        {series.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '5 4' : undefined}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            />
            <circle cx={x(last)} cy={y(s.values[last])} r="4.5" fill={s.color} stroke="#ffffff" strokeWidth="2" />
            {hover !== null && (
              <circle cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill={s.color} stroke="#ffffff" strokeWidth="2" />
            )}
          </g>
        ))}

        {endLabels.map((l) => (
          <text key={l.key} x={pad.left + innerW + 10} y={l.y} dy="0.32em" fontSize="13" fill="#14201d">
            <tspan fontWeight="700">{l.value}%</tspan>
            <tspan fill="#4b5754"> {l.label}</tspan>
          </text>
        ))}

        <rect x={pad.left - 10} y={pad.top} width={innerW + 20} height={innerH} fill="transparent" />
      </svg>

      {hover !== null && (
        <div className="chart-tooltip" style={{ left: tooltipLeft, top: 36 }} aria-hidden="true">
          <div className="tt-title">Week of {formatDate(weeks[hover], true)}</div>
          {[...series]
            .sort((a, b) => b.values[hover] - a.values[hover])
            .map((s) => (
              <div className="tt-row" key={s.key}>
                <span className={`swatch ${s.dashed ? 'dashed' : ''}`} style={s.dashed ? undefined : { background: s.color }} />
                <span className="tt-name">{s.label}</span>
                <strong>{s.values[hover]}%</strong>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
