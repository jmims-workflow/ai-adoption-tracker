import { Router } from 'express';
import { db } from '../db.js';
import { aiMode } from '../ai.js';
import { champions, currentWeek, employeeImpact, overview, teamAdoption, teamSeries, useCaseStats } from '../metrics.js';

const router = Router();

export const MINUTES_BY_BUCKET = { under_30: 20, '30_60': 45, '1_2': 90, over_2: 150 };
const SAVED_TIME = ['yes', 'not_really', 'did_not_use'];

router.get('/meta', (req, res) => {
  res.json({ aiMode, company: 'Northstar Systems', demoData: true });
});

router.get('/overview', (req, res) => res.json(overview()));

router.get('/teams', (req, res) => {
  res.json({ ...teamSeries(), current: teamAdoption(currentWeek()) });
});

router.get('/usecases', (req, res) => res.json({ useCases: useCaseStats() }));

router.get('/champions', (req, res) => res.json({ champions: champions() }));

router.get('/employees', (req, res) => {
  res.json({ employees: db.prepare('SELECT id, name, team, title FROM employees ORDER BY name').all() });
});

router.get('/me/:id', (req, res) => {
  const impact = employeeImpact(Number(req.params.id));
  if (!impact) return res.status(404).json({ error: 'Employee not found.' });
  res.json(impact);
});

router.post('/pulse', (req, res) => {
  const { employeeId, savedTime, amount, useCaseId, winText, promptText, taughtById } = req.body || {};
  const id = Number(employeeId);
  const employee = db.prepare('SELECT id FROM employees WHERE id = ?').get(id);
  if (!employee) return res.status(400).json({ error: 'Choose who you are first.' });
  if (!SAVED_TIME.includes(savedTime)) return res.status(400).json({ error: 'Answer the first question.' });

  let minutes = 0;
  if (savedTime === 'yes') {
    minutes = MINUTES_BY_BUCKET[amount];
    if (!minutes) return res.status(400).json({ error: 'Choose roughly how much time you saved.' });
  }

  let useCase = null;
  if (savedTime === 'yes' && useCaseId) {
    useCase = db.prepare('SELECT id FROM use_cases WHERE id = ?').get(Number(useCaseId))?.id ?? null;
  }

  let teacher = null;
  if (taughtById) {
    const t = Number(taughtById);
    if (t !== id) teacher = db.prepare('SELECT id FROM employees WHERE id = ?').get(t)?.id ?? null;
  }

  const win = typeof winText === 'string' && winText.trim() ? winText.trim().slice(0, 500) : null;
  const prompt = typeof promptText === 'string' && promptText.trim() ? promptText.trim().slice(0, 2000) : null;
  const week = currentWeek();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO pulse_responses (employee_id, week_start, saved_time, minutes, use_case_id, win_text, taught_by_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (employee_id, week_start) DO UPDATE SET
       saved_time = excluded.saved_time, minutes = excluded.minutes, use_case_id = excluded.use_case_id,
       win_text = excluded.win_text, taught_by_id = excluded.taught_by_id, created_at = excluded.created_at`
  ).run(id, week, savedTime, minutes, useCase, win, teacher, now);

  // A pasted prompt becomes this person's recipe for the use case they picked. Leaving it blank keeps the old one.
  if (prompt && useCase) {
    db.prepare(
      `INSERT INTO recipes (employee_id, use_case_id, prompt, week_start, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (employee_id, use_case_id) DO UPDATE SET
         prompt = excluded.prompt, week_start = excluded.week_start, updated_at = excluded.updated_at`
    ).run(id, useCase, prompt, week, now);
  }

  const impact = employeeImpact(id);
  res.json({ ok: true, monthHours: impact.monthHours, monthLabel: impact.monthLabel, minutes, recipeSaved: Boolean(prompt && useCase) });
});

export default router;
