import { useEffect, useRef, useState } from 'react';
import { api, formatDate, formatDateTime, formatNumber } from '../api.js';
import { AiButton, BarList, Card, CopyButton, DemoNote, ErrorMessage, Loading, RiskTag, StatTile } from '../components/ui.jsx';
import LineChart from '../components/LineChart.jsx';

const TEAM_COLORS = {
  // Validated categorical palette (see styles.css --series-*). Hex here because SVG attributes need it.
  Sales: '#2a78d6',
  'Customer Success': '#eb6834',
  Marketing: '#1baf7a',
  Operations: '#6250d6',
};

const NEXT_STEP_OPTIONS = [
  {
    kind: 'ask',
    label: 'Ask a champion',
    copy: 'Copy note',
    describe: (c, own, savedPrivate) =>
      own
        ? `A short note checking ${c.name} is still happy for their prompt to be shared, with an easy way to say no.`
        : savedPrivate
          ? `A short note asking ${c.name} if they would be willing to share the prompt they saved, with an easy way to say no.`
          : `A short note asking ${c.name} if they would share their approach, with an easy way to say no.`,
  },
  {
    kind: 'run',
    label: 'Run it yourself',
    copy: 'Copy invite',
    describe: (c, own) =>
      `An invite to a 15 minute session you lead, using ${own ? `${c.name}'s saved prompt, credited to them` : 'the starter recipe'}.`,
  },
  {
    kind: 'share',
    label: 'Share the recipe',
    copy: 'Copy message',
    describe: (c, own) =>
      own ? `A message to the team with ${c.name}'s prompt, credited to them, and one tip.` : 'A message to the team with the starter recipe and one tip.',
  },
];

function NeedsAttention({ attention }) {
  const [drafts, setDrafts] = useState({});
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const { champion, recipe } = attention;
  const own = recipe.source === 'champion';
  const options = NEXT_STEP_OPTIONS.filter((o) => champion || o.kind !== 'ask');
  const current = options.find((o) => o.kind === active);
  const draft = active ? drafts[active] : null;

  async function generate(kind) {
    setLoading(kind);
    setActive(kind);
    setError(null);
    try {
      const result = await api.post('/ai/next-step', { kind });
      setDrafts((d) => ({ ...d, [kind]: result }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card title={`${attention.needsAttention ? 'Needs attention' : 'Lowest adoption'}: ${attention.team.team}`} titleId="attention-title" tone="warn">
      <p className="warn-text">{attention.explanation}</p>
      <p style={{ marginTop: 12 }}>
        <strong>Suggested next step. </strong>
        {attention.nextStep}
      </p>
      {attention.useCase && (
        <p style={{ marginTop: 12 }}>
          <RiskTag risk={attention.useCase.risk} /> <span className="small">{attention.useCase.riskNote}</span>
        </p>
      )}
      {champion && (
        <p style={{ marginTop: 12 }}>
          <strong>Closest champion: </strong>
          {champion.name}, {champion.team}
          <span className="small muted line-below">{champion.reason}</span>
        </p>
      )}
      <p style={{ marginTop: 12 }}>
        <strong>Recipe: </strong>
        {own ? `${recipe.author}'s saved prompt` : 'Starter recipe from the playbook'}
        <span className="small muted line-below">
          {own
            ? 'Saved in their weekly pulse and marked OK to share, so drafts credit it to them.'
            : recipe.savedPrivate
              ? `${champion.name} saved a prompt for this but has not marked it OK to share, so drafts credit it to no one.`
              : `${champion ? `${champion.name} has not saved a prompt for this yet, so` : 'No champion has saved a prompt for this yet, so'} drafts credit it to no one.`}
        </span>
      </p>
      <ul className="option-list" aria-label="Choose a next step to draft">
        {options.map((o) => (
          <li key={o.kind}>
            <AiButton loading={loading === o.kind} disabled={Boolean(loading)} aria-pressed={active === o.kind} onClick={() => generate(o.kind)}>
              {o.label}
            </AiButton>
            <span className="small muted">{o.describe(champion, own, recipe.savedPrivate)}</span>
          </li>
        ))}
      </ul>
      <ErrorMessage error={error} />
      {draft && (
        <div aria-live="polite">
          <div className="ai-output">{draft.text}</div>
          <div className="btn-row">
            <CopyButton text={draft.text} label={current?.copy ?? 'Copy'} />
          </div>
          <DemoNote demo={draft.demo} />
        </div>
      )}
    </Card>
  );
}

function LeadershipUpdate() {
  const [result, setResult] = useState(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const editRef = useRef(null);

  async function generate(fresh) {
    setLoading(true);
    setError(null);
    try {
      const r = await api.post('/ai/leadership-update', { fresh });
      setResult(r);
      setText(r.text);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate(false);
  }, []);

  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);

  const bullets = text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);

  return (
    <Card title="Leadership update" titleId="leadership-title">
      {loading && !result && <Loading label="Writing this week's summary" />}
      <ErrorMessage error={error} />
      {result &&
        (editing ? (
          <div>
            <label htmlFor="leadership-edit" className="visually-hidden">
              Edit leadership update
            </label>
            <textarea id="leadership-edit" ref={editRef} rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setText(draft);
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="bullets" aria-live="polite">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <DemoNote demo={result.demo && text === result.text} />
            <div className="btn-row">
              <AiButton loading={loading} onClick={() => generate(true)} loadingText="Regenerating…">
                Regenerate
              </AiButton>
              <CopyButton text={bullets.map((b) => `- ${b}`).join('\n')} />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setDraft(text);
                  setEditing(true);
                }}
              >
                Edit
              </button>
            </div>
          </>
        ))}
    </Card>
  );
}

function TeamsTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/teams').then(setData).catch(() => setData({ error: true }));
  }, []);
  if (!data) return <Loading />;
  if (data.error) return <ErrorMessage error="Could not load team data." />;

  const series = [
    ...data.series.map((s) => ({ key: s.team, label: s.team, color: TEAM_COLORS[s.team], values: s.values })),
    { key: 'all', label: 'All teams', color: '#4b5754', values: data.overall, dashed: true },
  ];

  return (
    <div>
      <h3 className="card-title" style={{ marginBottom: 4 }}>
        Weekly adoption by team
      </h3>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Share of each team who used AI at least once that week, from the usage export.
      </p>
      <LineChart weeks={data.weeks} series={series} title="Weekly AI adoption by team over the last 8 weeks" />
      <details className="table-view">
        <summary>View as table</summary>
        <div className="table-scroll">
          <table>
            <caption className="visually-hidden">Weekly AI adoption by team, percent of people active</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                {series.map((s) => (
                  <th scope="col" className="num" key={s.key}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((w, i) => (
                <tr key={w}>
                  <th scope="row">{formatDate(w, true)}</th>
                  {series.map((s) => (
                    <td className="num" key={s.key}>
                      {s.values[i]}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function UseCasesTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/usecases').then(setData).catch(() => setData({ error: true }));
  }, []);
  if (!data) return <Loading />;
  if (data.error) return <ErrorMessage error="Could not load use cases." />;
  const items = data.useCases.map((u) => ({
    label: (
      <>
        {u.name} <RiskTag risk={u.risk} />
      </>
    ),
    key: u.id,
    value: u.hours,
    meta: `${u.people} ${u.people === 1 ? 'person' : 'people'}${u.product ? `, ${u.product}` : ''}. ${u.riskNote}`,
  }));
  return (
    <div>
      <h3 className="card-title" style={{ marginBottom: 4 }}>
        Top use cases by hours saved
      </h3>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Last 8 weeks, from pulse answers. Risk tags show how much care each use case needs.
      </p>
      <BarList items={items} />
    </div>
  );
}

function ChampionsTab() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/champions').then(setData).catch(() => setData({ error: true }));
  }, []);
  if (!data) return <Loading />;
  if (data.error) return <ErrorMessage error="Could not load champions." />;
  return (
    <div>
      <h3 className="card-title" style={{ marginBottom: 4 }}>
        Who taught whom
      </h3>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Credited by colleagues in the weekly pulse when they answered "Did someone show you how?"
      </p>
      <ul className="champion-list">
        {data.champions.map((c) => (
          <li className="card" key={c.id}>
            <p className="champion-name">{c.name}</p>
            <p className="muted small">
              {c.title}, {c.team}
            </p>
            <p style={{ marginTop: 8, fontWeight: 700 }}>
              Helped <span className="num">{c.learners.length}</span> {c.learners.length === 1 ? 'colleague' : 'colleagues'} start
            </p>
            <ul className="learners">
              {c.learners.map((l) => (
                <li key={l.id}>
                  <span>
                    {l.name} <span className="muted">({l.team})</span>
                  </span>
                  <span className="muted num">{formatDate(l.week)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABS = [
  { id: 'teams', label: 'Teams', Panel: TeamsTab },
  { id: 'usecases', label: 'Use cases', Panel: UseCasesTab },
  { id: 'champions', label: 'Champions', Panel: ChampionsTab },
];

function Tabs() {
  const [active, setActive] = useState('teams');
  const refs = useRef({});

  function onKeyDown(e, index) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = TABS[(index + dir + TABS.length) % TABS.length];
    setActive(next.id);
    refs.current[next.id]?.focus();
  }

  const current = TABS.find((t) => t.id === active);
  return (
    <section className="card" aria-label="Details">
      <div className="tablist" role="tablist" aria-label="Details">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => (refs.current[t.id] = el)}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            className="tab"
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0}>
        <current.Panel />
      </div>
    </section>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/overview').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorMessage error={error} />;
  if (!data) return <Loading />;

  const { tiles, sources, attention } = data;
  return (
    <div className="stack">
      <header>
        <p className="eyebrow">Week of {data.weekLabel}</p>
        <h1 className="page-title">{data.headline}</h1>
        <div className="sources">
          <p>
            Usage export last imported {sources.lastImportAt ? formatDateTime(sources.lastImportAt) : 'never'}
            {sources.lastImportFile ? ` (${sources.lastImportFile})` : ''}
          </p>
          <p>
            {sources.pulseResponses} of {sources.employees} people answered this week's pulse
          </p>
        </div>
      </header>

      <div className="grid-3">
        <StatTile
          label="Used AI this week"
          value={`${tiles.adoption.value}%`}
          sub={`${tiles.adoption.active} of ${tiles.adoption.total} people`}
          change={tiles.adoption.change}
          changeUnit=" pts"
        />
        <StatTile
          label="Hours saved this week"
          value={formatNumber(tiles.hours.value)}
          sub="Self-reported in the weekly pulse"
          change={tiles.hours.change}
          changeUnit=" h"
        />
        <StatTile
          label="People taught by a colleague"
          value={tiles.taught.value}
          sub="Since the rollout began"
          change={tiles.taught.change}
        />
      </div>

      <div className="grid-2">
        <NeedsAttention attention={attention} />
        <LeadershipUpdate />
      </div>

      <Tabs />
    </div>
  );
}
