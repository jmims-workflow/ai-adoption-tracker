import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { db } from '../db.js';
import { mondayOf } from '../dates.js';
import { adoption, overview } from '../metrics.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_FILE = path.join(here, '..', '..', 'sample-data', 'usage-export-week-2026-10-26.csv');
const REQUIRED = ['email', 'date', 'active_days', 'message_count'];

function parseCsv(text) {
  const records = parse(text, { columns: (h) => h.map((c) => c.trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true });
  const header = records.length ? Object.keys(records[0]) : [];
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) {
    const err = new Error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Expected email, date, active_days, message_count.`);
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return records.map((r) => ({ email: r.email, date: r.date, active_days: r.active_days, message_count: r.message_count }));
}

// Validate rows against the employee list and roll them up to one row per person per week.
function analyze(rows) {
  const employees = db.prepare('SELECT id, name, email, team FROM employees').all();
  const byEmail = new Map(employees.map((e) => [e.email.toLowerCase(), e]));
  const checked = rows.map((r, i) => {
    const email = String(r.email || '').trim().toLowerCase();
    const date = String(r.date || '').trim().slice(0, 10);
    const activeDays = Number(r.active_days);
    const messages = Number(r.message_count);
    const base = { line: i + 2, email, date, activeDays, messages };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
      return { ...base, status: 'invalid', note: 'Date must be YYYY-MM-DD' };
    }
    if (!Number.isInteger(activeDays) || activeDays < 0 || activeDays > 7 || !Number.isInteger(messages) || messages < 0) {
      return { ...base, status: 'invalid', note: 'Numbers must be whole and not negative' };
    }
    const employee = byEmail.get(email);
    if (!employee) return { ...base, status: 'unknown', note: 'Not in the employee list' };
    return { ...base, status: 'matched', week: mondayOf(date), employeeId: employee.id, name: employee.name, team: employee.team };
  });

  const rollup = new Map();
  for (const r of checked.filter((x) => x.status === 'matched')) {
    const key = `${r.employeeId}|${r.week}`;
    const cur = rollup.get(key) || { employeeId: r.employeeId, week: r.week, activeDays: 0, messages: 0 };
    cur.activeDays = Math.min(7, cur.activeDays + r.activeDays);
    cur.messages += r.messages;
    rollup.set(key, cur);
  }
  const updates = [...rollup.values()];
  const weeks = [...new Set(updates.map((u) => u.week))].sort();

  // Projected adoption for each week in the file, after this import.
  const total = employees.length;
  const projections = weeks.map((week) => {
    const before = adoption(week);
    const existing = new Set(
      db.prepare('SELECT employee_id FROM usage_weekly WHERE week_start = ? AND active_days > 0').all(week).map((r) => r.employee_id)
    );
    for (const u of updates.filter((x) => x.week === week)) {
      if (u.activeDays > 0) existing.add(u.employeeId);
      else existing.delete(u.employeeId);
    }
    return { week, before: before.pct, after: Math.round((existing.size / total) * 100), activeAfter: existing.size, total };
  });

  return {
    rows: checked,
    updates,
    summary: {
      rowCount: checked.length,
      matched: checked.filter((r) => r.status === 'matched').length,
      unknown: checked.filter((r) => r.status === 'unknown').length,
      invalid: checked.filter((r) => r.status === 'invalid').length,
      weeks,
      projections,
    },
  };
}

function previewResponse(filename, rows) {
  const { rows: checked, summary } = analyze(rows);
  return { filename, rows: checked, summary, raw: rows };
}

router.post('/preview', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a CSV file to upload.' });
    const rows = parseCsv(req.file.buffer.toString('utf8'));
    res.json(previewResponse(req.file.originalname, rows));
  } catch (err) {
    if (err.code && String(err.code).startsWith('CSV_')) {
      return res.status(400).json({ error: `That file could not be read as CSV: ${err.message}` });
    }
    next(err);
  }
});

router.get('/sample', (req, res, next) => {
  try {
    const rows = parseCsv(fs.readFileSync(SAMPLE_FILE, 'utf8'));
    res.json(previewResponse(path.basename(SAMPLE_FILE), rows));
  } catch (err) {
    next(err);
  }
});

router.post('/commit', (req, res) => {
  const { filename, rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Nothing to import.' });
  if (rows.length > 5000) return res.status(400).json({ error: 'That file has too many rows for this demo.' });
  const { updates, summary } = analyze(rows);
  if (!updates.length) return res.status(400).json({ error: 'No rows matched an employee, so nothing was updated.' });

  const upsert = db.prepare(
    `INSERT INTO usage_weekly (employee_id, week_start, active_days, message_count, source)
     VALUES (?, ?, ?, ?, 'import')
     ON CONFLICT (employee_id, week_start) DO UPDATE SET
       active_days = excluded.active_days, message_count = excluded.message_count, source = 'import'`
  );
  db.transaction(() => {
    for (const u of updates) upsert.run(u.employeeId, u.week, u.activeDays, u.messages);
    db.prepare('INSERT INTO imports (filename, imported_at, row_count, matched_count) VALUES (?, ?, ?, ?)').run(
      String(filename || 'usage-export.csv').slice(0, 200),
      new Date().toISOString(),
      summary.rowCount,
      summary.matched
    );
  })();

  res.json({ ok: true, summary, overview: overview() });
});

export default router;
