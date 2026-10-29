import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatNumber } from '../api.js';
import { ErrorMessage } from '../components/ui.jsx';
import ViewerPicker from '../components/ViewerPicker.jsx';
import { useViewer } from '../viewer.js';

const Q1 = [
  { value: 'yes', label: 'Yes' },
  { value: 'not_really', label: 'Not really' },
  { value: 'did_not_use', label: 'I did not use it' },
];

const Q2 = [
  { value: 'under_30', label: 'Under 30 min' },
  { value: '30_60', label: '30 to 60 min' },
  { value: '1_2', label: '1 to 2 hours' },
  { value: 'over_2', label: 'More than 2' },
];

function Choice({ name, value, label, checked, onChange }) {
  return (
    <label className="choice">
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} />
      <span>{label}</span>
    </label>
  );
}

function ThankYou({ result, name, onEdit }) {
  return (
    <div className="card thanks" role="status">
      <svg className="check-mark" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r="28" fill="#e3efed" />
        <path d="M17 29 L25 37 L40 20" fill="none" stroke="#0E6B62" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h1 className="page-title small" style={{ margin: '0 auto' }}>
        Thanks, {name.split(' ')[0]}.
      </h1>
      <p className="muted" style={{ marginTop: 12 }}>
        This month you have saved
      </p>
      <p className="big-number" style={{ marginTop: 8 }}>
        {formatNumber(result.monthHours)}
        <span className="big-unit">hours</span>
      </p>
      <p className="muted small" style={{ marginTop: 8 }}>
        It is all in your own record, ready for your next review.
      </p>
      <div className="btn-row" style={{ flexDirection: 'column' }}>
        <Link to="/me" className="btn btn-primary btn-block">
          See my impact
        </Link>
        <button type="button" className="btn btn-secondary btn-block" onClick={onEdit}>
          Change my answer
        </button>
      </div>
    </div>
  );
}

export default function Pulse() {
  const { viewerId, employees } = useViewer();
  const [meta, setMeta] = useState(null);
  const [useCases, setUseCases] = useState([]);
  const [savedTime, setSavedTime] = useState('');
  const [amount, setAmount] = useState('');
  const [useCaseId, setUseCaseId] = useState('');
  const [winText, setWinText] = useState('');
  const [taughtById, setTaughtById] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/usecases').then((d) => setUseCases(d.useCases)).catch(() => {});
  }, []);

  useEffect(() => {
    setResult(null);
    setError(null);
    api.get(`/me/${viewerId}`).then(setMeta).catch(() => setMeta(null));
  }, [viewerId]);

  const me = employees.find((e) => e.id === viewerId);
  const colleagues = employees.filter((e) => e.id !== viewerId);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!savedTime) return setError('Answer the first question to send.');
    if (savedTime === 'yes' && !amount) return setError('Choose roughly how much time you saved.');
    setSending(true);
    try {
      const r = await api.post('/pulse', {
        employeeId: viewerId,
        savedTime,
        amount: savedTime === 'yes' ? amount : null,
        useCaseId: savedTime === 'yes' && useCaseId ? Number(useCaseId) : null,
        winText,
        taughtById: taughtById ? Number(taughtById) : null,
      });
      setResult(r);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (result && me) {
    return (
      <div className="narrow">
        <ThankYou result={result} name={me.name} onEdit={() => setResult(null)} />
      </div>
    );
  }

  return (
    <div className="narrow stack">
      <header>
        <p className="eyebrow">Weekly pulse</p>
        <h1 className="page-title small">How did AI help this week?</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          About 20 seconds. Every answer builds your own impact record.
        </p>
      </header>

      <ViewerPicker />
      {meta?.answeredThisWeek && (
        <p className="muted small">You already answered this week. Sending again replaces your answer.</p>
      )}

      <form className="stack" onSubmit={submit} noValidate>
        <fieldset>
          <legend>Did AI save you time this week?</legend>
          <div className="choices">
            {Q1.map((o) => (
              <Choice key={o.value} name="saved" {...o} checked={savedTime === o.value} onChange={setSavedTime} />
            ))}
          </div>
        </fieldset>

        {savedTime === 'yes' && (
          <>
            <fieldset>
              <legend>Roughly how much?</legend>
              <div className="choices two-col">
                {Q2.map((o) => (
                  <Choice key={o.value} name="amount" {...o} checked={amount === o.value} onChange={setAmount} />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend style={{ fontSize: 16 }}>
                What was it for? <span className="hint">Optional</span>
              </legend>
              <div className="chips">
                {useCases.map((u) => (
                  <Choice
                    key={u.id}
                    name="usecase"
                    value={String(u.id)}
                    label={u.name}
                    checked={useCaseId === String(u.id)}
                    onChange={setUseCaseId}
                  />
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div>
          <label htmlFor="win">
            Share a win <span className="hint">Optional</span>
          </label>
          <textarea
            id="win"
            rows={3}
            maxLength={500}
            placeholder="For example: summarized a long ticket thread in two minutes."
            value={winText}
            onChange={(e) => setWinText(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="taught">
            Did someone show you how? <span className="hint">Optional. They get credit as a champion.</span>
          </label>
          <select id="taught" value={taughtById} onChange={(e) => setTaughtById(e.target.value)}>
            <option value="">No one this week</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.team}
              </option>
            ))}
          </select>
        </div>

        <ErrorMessage error={error} />
        <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
