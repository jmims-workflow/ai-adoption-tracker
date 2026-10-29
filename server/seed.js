// Fictional demo data for Northstar Systems. Every person, email and number here is made up.
import { db, resetSchema, isEmpty } from './db.js';
import { addDays } from './dates.js';

export const FIRST_WEEK = '2026-09-07';
export const WEEKS = Array.from({ length: 8 }, (_, i) => addDays(FIRST_WEEK, i * 7));

// Each pattern is 8 weeks of usage, oldest first: 1 = active that week.
// Shape: Sales strong, Operations lagging, three power users, a few who tried once and stopped.
const PEOPLE = [
  ['Maya Chen', 'Sales', 'Account Executive', '11111111', 'power'],
  ['Diego Alvarez', 'Sales', 'Sales Manager', '11111111'],
  ['Priya Raman', 'Sales', 'Account Executive', '01111111'],
  ['Tom Becker', 'Sales', 'Sales Development Rep', '00111111'],
  ['Aisha Okafor', 'Sales', 'Account Executive', '01101111'],
  ['Ben Harper', 'Sales', 'Sales Development Rep', '00011111'],
  ['Lena Novak', 'Sales', 'Solutions Consultant', '00001101'],
  ['Marcus Reed', 'Sales', 'Account Executive', '10000000'],
  ['Sofia Russo', 'Sales', 'Sales Operations Analyst', '00111011'],
  ['Jordan Kim', 'Customer Success', 'Customer Success Manager', '11111111', 'power'],
  ['Hannah Weiss', 'Customer Success', 'Customer Success Lead', '01111111'],
  ['Omar Haddad', 'Customer Success', 'Support Specialist', '00111111'],
  ['Grace Liu', 'Customer Success', 'Customer Success Manager', '00011110'],
  ['Ethan Brooks', 'Customer Success', 'Onboarding Specialist', '00001011'],
  ['Nina Petrova', 'Customer Success', 'Support Specialist', '01000000'],
  ['Sam Carter', 'Customer Success', 'Support Specialist', '00000001'],
  ['Chloe Martin', 'Marketing', 'Content Marketing Manager', '11111111', 'power'],
  ['Raj Patel', 'Marketing', 'Product Marketing Manager', '00111111'],
  ['Ella Thompson', 'Marketing', 'Marketing Coordinator', '00010111'],
  ['Leo Fischer', 'Marketing', 'Designer', '00000001'],
  ['Zoe Adams', 'Marketing', 'Events Manager', '00110000'],
  ['Carlos Mendes', 'Operations', 'Operations Manager', '00000111'],
  ['Ruth Okonkwo', 'Operations', 'Billing Specialist', '00100000'],
  ['Victor Hale', 'Operations', 'IT Administrator', '00000000'],
  ['Ines Duarte', 'Operations', 'Procurement Analyst', '00000100'],
];

const USE_CASES = [
  [1, 'Call notes and follow-up emails', 'Connect', 'green', 'Internal drafts that a person reviews before sending.'],
  [2, 'Account research briefs', null, 'green', 'Uses public information only.'],
  [3, 'FlowOS support ticket summaries', 'FlowOS', 'yellow', 'Contains customer details. Use the approved workspace and leave out personal data.'],
  [4, 'Campaign copy drafts', 'Connect', 'green', 'Marketing review happens before anything is published.'],
  [5, 'Insight report narratives', 'Insight', 'yellow', 'Customer metrics. Check every number against the source report.'],
  [6, 'Contract and pricing review', null, 'red', 'Legal and pricing terms. Needs legal review; never rely on AI output alone.'],
  [7, 'Process documentation', 'FlowOS', 'green', 'Internal procedures with no customer data.'],
];

const TEAM_USE_CASES = {
  Sales: { 1: 4, 2: 3, 6: 0.6 },
  'Customer Success': { 1: 3, 3: 3, 5: 2 },
  Marketing: { 4: 4, 5: 2, 2: 1 },
  Operations: { 7: 3, 3: 2, 6: 1 },
};

// Learner -> champion who showed them how. Credited in the learner's first active week.
const TAUGHT_BY = {
  'Tom Becker': 'Maya Chen',
  'Ben Harper': 'Maya Chen',
  'Lena Novak': 'Maya Chen',
  'Sam Carter': 'Maya Chen',
  'Zoe Adams': 'Maya Chen',
  'Priya Raman': 'Diego Alvarez',
  'Aisha Okafor': 'Diego Alvarez',
  'Sofia Russo': 'Diego Alvarez',
  'Omar Haddad': 'Jordan Kim',
  'Grace Liu': 'Jordan Kim',
  'Ethan Brooks': 'Jordan Kim',
  'Raj Patel': 'Hannah Weiss',
  'Ella Thompson': 'Hannah Weiss',
  'Carlos Mendes': 'Hannah Weiss',
  'Leo Fischer': 'Hannah Weiss',
};

const WINS = {
  1: [
    'Cut my post-call follow-up from 20 minutes to 5. Customers get the recap the same afternoon.',
    'Turned messy discovery notes into a clean summary for the FlowOS renewal team.',
    'Drafted five follow-up emails after a trade show in one sitting.',
    'Used it to prep talking points before a tough Connect pricing call.',
  ],
  2: [
    'Built a one-page brief on a new prospect in 10 minutes instead of an hour.',
    'Found three expansion angles for an Insight account I would have missed.',
    'Prepared for a QBR with a summary of the customer\'s public earnings call.',
  ],
  3: [
    'Summarized a 40-message FlowOS ticket thread so the next shift could pick it up fast.',
    'Grouped a week of tickets by root cause for the product team.',
    'Wrote a clearer escalation note, and engineering replied the same day.',
  ],
  4: [
    'Got three subject line options for the Connect launch email and the winner beat our average open rate.',
    'Drafted the first version of the Insight webinar landing page in half the usual time.',
    'Rewrote a long product page into a short social post series.',
  ],
  5: [
    'Turned an Insight usage export into a plain-language story for a customer exec.',
    'Wrote the monthly health summary for my top accounts in one pass.',
  ],
  6: [
    'Spotted an auto-renewal clause to flag for legal before the call.',
  ],
  7: [
    'Turned the month-end close checklist into a step-by-step guide new hires can follow.',
    'Documented the FlowOS access request process that only lived in my head.',
  ],
};

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function emailFor(name) {
  return `${name.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.')}@northstar.example`;
}

export function seed() {
  const rand = mulberry32(20261026);
  resetSchema();

  const insertEmployee = db.prepare('INSERT INTO employees (id, name, email, team, title) VALUES (?, ?, ?, ?, ?)');
  const insertUseCase = db.prepare('INSERT INTO use_cases (id, name, product, risk, risk_note) VALUES (?, ?, ?, ?, ?)');
  const insertUsage = db.prepare(
    'INSERT INTO usage_weekly (employee_id, week_start, active_days, message_count, source) VALUES (?, ?, ?, ?, ?)'
  );
  const insertPulse = db.prepare(`
    INSERT INTO pulse_responses (employee_id, week_start, saved_time, minutes, use_case_id, win_text, taught_by_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertImport = db.prepare(
    'INSERT INTO imports (filename, imported_at, row_count, matched_count) VALUES (?, ?, ?, ?)'
  );

  const run = db.transaction(() => {
    USE_CASES.forEach((uc) => insertUseCase.run(...uc));

    const idByName = {};
    PEOPLE.forEach(([name, team, title], i) => {
      idByName[name] = i + 1;
      insertEmployee.run(i + 1, name, emailFor(name), team, title);
    });

    const usedWins = new Set();
    const lastWeek = WEEKS.length - 1;

    PEOPLE.forEach(([name, team, , pattern, kind]) => {
      const id = idByName[name];
      const power = kind === 'power';
      const firstActive = pattern.indexOf('1');

      WEEKS.forEach((week, w) => {
        const active = pattern[w] === '1';
        const activeDays = active ? (power ? 4 + Math.round(rand()) : 1 + Math.floor(rand() * 4)) : 0;
        const messages = active ? (power ? 60 + Math.floor(rand() * 60) : 6 + Math.floor(rand() * 34)) : 0;
        insertUsage.run(id, week, activeDays, messages, 'import');

        // Pulse: not everyone answers every week.
        const credited = w === firstActive && TAUGHT_BY[name];
        const everActive = firstActive !== -1 && firstActive <= w;
        let answers;
        if (credited) answers = true;
        else if (active) answers = rand() < (power ? 0.95 : 0.8);
        else answers = rand() < (everActive ? 0.3 : 0.15);
        if (!answers) return;

        const createdAt = `${addDays(week, w === lastWeek ? 2 : 4)}T${String(9 + Math.floor(rand() * 8)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00Z`;
        const taughtBy = credited ? idByName[TAUGHT_BY[name]] : null;

        if (!active) {
          insertPulse.run(id, week, 'did_not_use', 0, null, null, null, createdAt);
          return;
        }
        if (rand() > 0.82 && !power) {
          insertPulse.run(id, week, 'not_really', 0, null, null, taughtBy, createdAt);
          return;
        }
        const buckets = power ? { 20: 1, 45: 2.5, 90: 3.5, 150: 3 } : { 20: 3.5, 45: 3.5, 90: 2, 150: 1 };
        const minutes = Number(pickWeighted(rand, buckets));
        const useCaseId = Number(pickWeighted(rand, TEAM_USE_CASES[team]));
        let win = null;
        if (rand() < (power ? 0.45 : 0.25)) {
          const options = WINS[useCaseId].filter((t) => !usedWins.has(t));
          if (options.length) {
            win = options[Math.floor(rand() * options.length)];
            usedWins.add(win);
          }
        }
        insertPulse.run(id, week, 'yes', minutes, useCaseId, win, taughtBy, createdAt);
      });
    });

    insertImport.run('northstar-ai-usage-2026-10-26.csv', '2026-10-27T09:12:00Z', PEOPLE.length, PEOPLE.length);
  });
  run();
}

export function seedIfEmpty() {
  if (isEmpty()) {
    seed();
    console.log('Seeded demo data for Northstar Systems.');
  }
}

if (process.argv.includes('--reset')) {
  seed();
  console.log('Demo data reset.');
}
