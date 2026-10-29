import { useState } from 'react';
import { copyText } from '../api.js';

export function Card({ title, action, tone, children, className = '', titleId, as: Tag = 'section' }) {
  return (
    <Tag className={`card ${tone || ''} ${className}`} aria-labelledby={title ? titleId : undefined}>
      {(title || action) && (
        <div className="card-head">
          {title && (
            <h2 className="card-title" id={titleId}>
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function Change({ value, unit = '', suffix = 'vs last week' }) {
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const word = dir === 'up' ? 'Up' : dir === 'down' ? 'Down' : 'No change';
  return (
    <p className={`change ${dir}`}>
      <span aria-hidden="true">{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▬'}</span>
      <span className="visually-hidden">{word}</span>
      <span>
        {sign}
        {Math.abs(value)}
        {unit}
      </span>
      <span className="vs">{suffix}</span>
    </p>
  );
}

export function StatTile({ label, value, sub, change, changeUnit }) {
  return (
    <div className="card">
      <p className="tile-label">{label}</p>
      <p className="tile-value">{value}</p>
      {sub && <p className="tile-sub">{sub}</p>}
      {change !== undefined && <Change value={change} unit={changeUnit} />}
    </div>
  );
}

function Sparkle() {
  return (
    <svg className="ai-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill="currentColor" />
    </svg>
  );
}

// Marigold is reserved for buttons that call the AI.
export function AiButton({ loading, children, loadingText = 'Writing…', ...props }) {
  return (
    <button type="button" className="btn btn-ai" disabled={loading} aria-busy={loading || undefined} {...props}>
      {loading ? <span className="spinner" aria-hidden="true" /> : <Sparkle />}
      {loading ? loadingText : children}
    </button>
  );
}

export function CopyButton({ text, label = 'Copy', onCopied }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={!text}
        onClick={async () => {
          const ok = await copyText(text);
          setCopied(ok);
          onCopied?.(ok);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copied' : label}
      </button>
      <span className="visually-hidden" role="status">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}

export function DemoNote({ demo }) {
  if (!demo) return null;
  return <p className="demo-note">Sample text. Demo mode is on because no API key is set on the server.</p>;
}

const RISK_LABEL = { green: 'Low risk', yellow: 'Use care', red: 'High risk' };

export function RiskTag({ risk }) {
  return (
    <span className={`risk ${risk}`}>
      <span className="risk-dot" aria-hidden="true" />
      {RISK_LABEL[risk]}
    </span>
  );
}

export function BarList({ items, unit = 'h', max }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li key={item.key ?? item.label}>
          <div className="bar-top">
            <span className="bar-label">{item.label}</span>
            <span className="bar-value">
              {item.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} {unit}
            </span>
          </div>
          <div className="bar-track" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${Math.max(2, (item.value / top) * 100)}%` }} />
          </div>
          {item.meta && <div className="bar-meta">{item.meta}</div>}
        </li>
      ))}
    </ul>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <p className="muted" role="status">
      {label}…
    </p>
  );
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error}
    </p>
  );
}
