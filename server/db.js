import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const DB_PATH = path.join(dataDir, 'tracker.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      team TEXT NOT NULL,
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS use_cases (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      product TEXT,
      risk TEXT NOT NULL CHECK (risk IN ('green', 'yellow', 'red')),
      risk_note TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_weekly (
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      week_start TEXT NOT NULL,
      active_days INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'seed',
      PRIMARY KEY (employee_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS pulse_responses (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      week_start TEXT NOT NULL,
      saved_time TEXT NOT NULL CHECK (saved_time IN ('yes', 'not_really', 'did_not_use')),
      minutes INTEGER NOT NULL DEFAULT 0,
      use_case_id INTEGER REFERENCES use_cases(id),
      win_text TEXT,
      taught_by_id INTEGER REFERENCES employees(id),
      created_at TEXT NOT NULL,
      UNIQUE (employee_id, week_start)
    );

    -- A person's own prompt for a use case, pasted in the weekly pulse. Latest one wins.
    CREATE TABLE IF NOT EXISTS recipes (
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      use_case_id INTEGER NOT NULL REFERENCES use_cases(id),
      prompt TEXT NOT NULL,
      week_start TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (employee_id, use_case_id)
    );

    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      matched_count INTEGER NOT NULL
    );
  `);
}

export function resetSchema() {
  db.exec(`
    DROP TABLE IF EXISTS imports;
    DROP TABLE IF EXISTS recipes;
    DROP TABLE IF EXISTS pulse_responses;
    DROP TABLE IF EXISTS usage_weekly;
    DROP TABLE IF EXISTS use_cases;
    DROP TABLE IF EXISTS employees;
  `);
  createSchema();
}

export function isEmpty() {
  createSchema();
  return db.prepare('SELECT COUNT(*) AS n FROM employees').get().n === 0;
}
