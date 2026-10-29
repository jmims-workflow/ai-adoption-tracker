import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, copyText, formatDate, formatNumber } from '../api.js';
import { AiButton, BarList, Card, DemoNote, ErrorMessage, Loading } from '../components/ui.jsx';
import ViewerPicker from '../components/ViewerPicker.jsx';
import { useViewer } from '../viewer.js';

function ReviewSummary({ employeeId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    setResult(null);
    setStatus('');
  }, [employeeId]);

  async function run() {
    setLoading(true);
    setError(null);
    setStatus('');
    try {
      const r = await api.post('/ai/review-summary', { employeeId });
      setResult(r);
      const ok = await copyText(r.text);
      setStatus(ok ? 'Copied to your clipboard. Paste it into your review.' : 'Select the text below to copy it.');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Use it in your review" titleId="review-title">
      <p className="muted small">Turn your record into a short paragraph you can paste into a self-review.</p>
      <div className="btn-row">
        <AiButton loading={loading} onClick={run} className="btn btn-ai btn-block">
          Copy summary for my review
        </AiButton>
      </div>
      <p className="status" role="status" style={{ marginTop: 8 }}>
        {status}
      </p>
      <ErrorMessage error={error} />
      {result && (
        <>
          <div className="ai-output">{result.text}</div>
          <DemoNote demo={result.demo} />
        </>
      )}
    </Card>
  );
}

export default function MyImpact() {
  const { viewerId } = useViewer();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    api
      .get(`/me/${viewerId}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [viewerId]);

  return (
    <div className="narrow stack">
      <header>
        <p className="eyebrow">My AI impact</p>
        <h1 className="page-title small">{data ? `${data.employee.name}'s record` : 'Your record'}</h1>
      </header>
      <ViewerPicker />
      <ErrorMessage error={error} />
      {!data && !error && <Loading />}
      {data && (
        <>
          <Card>
            <p className="tile-label">Hours saved in {data.monthLabel}</p>
            <p className="big-number" style={{ marginTop: 8 }}>
              {formatNumber(data.monthHours)}
              <span className="big-unit">hours</span>
            </p>
            <p className="muted small" style={{ marginTop: 8 }}>
              {formatNumber(data.totalHours)} hours since you started answering the pulse.
            </p>
            {!data.answeredThisWeek && (
              <Link to="/pulse" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
                Add this week
              </Link>
            )}
          </Card>

          <Card title="Where the time came from" titleId="where-title">
            {data.byUseCase.length ? (
              <BarList items={data.byUseCase.map((u) => ({ label: u.name, value: u.hours }))} />
            ) : (
              <p className="muted">
                Nothing yet this month. When you answer the pulse with Yes, pick what it was for and it shows up here.
              </p>
            )}
          </Card>

          <Card title={`You helped ${data.helped.length} ${data.helped.length === 1 ? 'colleague' : 'colleagues'} start`} titleId="helped-title">
            {data.helped.length ? (
              <ul className="learners" style={{ marginTop: 0 }}>
                {data.helped.map((h) => (
                  <li key={h.name}>
                    <span>
                      {h.name} <span className="muted">({h.team})</span>
                    </span>
                    <span className="muted num">{formatDate(h.week)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                When a colleague says you showed them how, they credit you in their pulse and it appears here.
              </p>
            )}
          </Card>

          <Card title="Wins you shared" titleId="wins-title">
            {data.wins.length ? (
              <ul className="wins">
                {data.wins.map((w, i) => (
                  <li key={i}>
                    <blockquote>{w.text}</blockquote>
                    <p className="win-meta">
                      Week of {formatDate(w.week)}
                      {w.useCase ? `, ${w.useCase}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Share a win in the weekly pulse and it is saved here in your own words.</p>
            )}
          </Card>

          <ReviewSummary employeeId={viewerId} />
        </>
      )}
    </div>
  );
}
