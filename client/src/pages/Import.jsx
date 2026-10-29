import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate } from '../api.js';
import { Card, ErrorMessage } from '../components/ui.jsx';

const STATUS_LABEL = { matched: 'Matched', unknown: 'Skipped', invalid: 'Error' };

export default function Import() {
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  async function load(promise) {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setPreview(await promise);
    } catch (e) {
      setPreview(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    load(api.post('/import/preview', form));
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post('/import/commit', { filename: preview.filename, rows: preview.raw });
      setDone(r);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const s = preview?.summary;

  return (
    <div className="stack">
      <header>
        <p className="eyebrow">Admin</p>
        <h1 className="page-title small">Import a usage export</h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: '60ch' }}>
          Adoption numbers come from your AI tool's admin usage report, so nobody has to log anything to be counted.
          Upload a CSV with the columns <code>email</code>, <code>date</code>, <code>active_days</code> and{' '}
          <code>message_count</code>. Rows are grouped into the week that contains their date.
        </p>
      </header>

      <Card title="Choose a file" titleId="file-title">
        <div className="file-drop">
          <input
            id="csv"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="visually-hidden file-input"
          />
          <label htmlFor="csv" className="btn btn-primary" style={{ display: 'inline-flex', marginBottom: 0 }}>
            Upload CSV
          </label>
          <p className="muted small" style={{ marginTop: 12 }}>
            or{' '}
            <button type="button" className="btn btn-secondary" onClick={() => load(api.get('/import/sample'))} disabled={busy}>
              Use the sample file
            </button>
          </p>
          <p className="muted small" style={{ marginTop: 8 }}>
            The sample lives in <code>sample-data/</code> in the repo.
          </p>
        </div>
        <ErrorMessage error={error} />
        {busy && !preview && (
          <p className="muted" role="status">
            Reading file…
          </p>
        )}
      </Card>

      {done && (
        <Card title="Adoption numbers updated" titleId="done-title">
          <p role="status">
            Imported {done.summary.matched} rows. {done.overview.tiles.adoption.active} of {done.overview.tiles.adoption.total}{' '}
            people used AI in the week of {done.overview.weekLabel} ({done.overview.tiles.adoption.value}%).
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>{done.overview.headline}</strong>
          </p>
          <div className="btn-row">
            <Link to="/" className="btn btn-primary">
              See the overview
            </Link>
          </div>
        </Card>
      )}

      {preview && (
        <Card title={`Preview: ${preview.filename}`} titleId="preview-title">
          <div className="summary-stats">
            <div>
              <strong>{s.rowCount}</strong>
              <span className="muted small">rows in file</span>
            </div>
            <div>
              <strong>{s.matched}</strong>
              <span className="muted small">matched to employees</span>
            </div>
            <div>
              <strong>{s.unknown + s.invalid}</strong>
              <span className="muted small">will be skipped</span>
            </div>
          </div>

          {s.projections.map((p) => (
            <p key={p.week} style={{ marginTop: 16 }}>
              Week of {formatDate(p.week, true)}: adoption goes from <strong className="num">{p.before}%</strong> to{' '}
              <strong className="num">{p.after}%</strong> ({p.activeAfter} of {p.total} people).
            </p>
          ))}

          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table>
              <caption className="visually-hidden">Rows in the uploaded file</caption>
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Email</th>
                  <th scope="col">Person</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="num">
                    Active days
                  </th>
                  <th scope="col" className="num">
                    Messages
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.status !== 'matched' ? `row-${r.status}` : undefined}>
                    <td>
                      <strong>{STATUS_LABEL[r.status]}</strong>
                      {r.note ? <span className="small">. {r.note}</span> : null}
                    </td>
                    <td>{r.email}</td>
                    <td>{r.name ? `${r.name}, ${r.team}` : ''}</td>
                    <td className="num">{r.date}</td>
                    <td className="num">{Number.isFinite(r.activeDays) ? r.activeDays : ''}</td>
                    <td className="num">{Number.isFinite(r.messages) ? r.messages : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={commit} disabled={busy || s.matched === 0}>
              {busy ? 'Updating…' : 'Update adoption numbers'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
