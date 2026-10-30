import { db } from './db.js';
import { addDays, formatWeek } from './dates.js';
import { starterRecipe } from './playbook.js';

export const TEAMS = ['Sales', 'Customer Success', 'Marketing', 'Operations'];

// Use case name for mid-sentence text: lowercase first letter, but keep product names as written.
export const inSentence = (name) => (/^(FlowOS|Connect|Insight)\b/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

const round1 = (n) => Math.round(n * 10) / 10;
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

export function currentWeek() {
  return db.prepare('SELECT MAX(week_start) AS w FROM usage_weekly').get().w;
}

export function recentWeeks(count = 8) {
  return db
    .prepare('SELECT DISTINCT week_start AS w FROM usage_weekly ORDER BY w DESC LIMIT ?')
    .all(count)
    .map((r) => r.w)
    .reverse();
}

export function adoption(week) {
  const total = db.prepare('SELECT COUNT(*) AS n FROM employees').get().n;
  const active = db
    .prepare('SELECT COUNT(*) AS n FROM usage_weekly WHERE week_start = ? AND active_days > 0')
    .get(week).n;
  return { active, total, pct: pct(active, total) };
}

export function teamAdoption(week) {
  const rows = db
    .prepare(
      `SELECT e.team,
              COUNT(*) AS total,
              SUM(CASE WHEN u.active_days > 0 THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN NOT EXISTS (
                SELECT 1 FROM usage_weekly u2
                WHERE u2.employee_id = e.id AND u2.active_days > 0 AND u2.week_start <= ?
              ) THEN 1 ELSE 0 END) AS never_tried
       FROM employees e
       LEFT JOIN usage_weekly u ON u.employee_id = e.id AND u.week_start = ?
       GROUP BY e.team`
    )
    .all(week, week);
  return TEAMS.map((team) => {
    const r = rows.find((x) => x.team === team) || { total: 0, active: 0, never_tried: 0 };
    return { team, total: r.total, active: r.active, neverTried: r.never_tried, pct: pct(r.active, r.total) };
  });
}

export function hoursSaved(week) {
  const { m } = db.prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM pulse_responses WHERE week_start = ?').get(week);
  return round1(m / 60);
}

export function peopleTaught(throughWeek) {
  return db
    .prepare(
      'SELECT COUNT(DISTINCT employee_id) AS n FROM pulse_responses WHERE taught_by_id IS NOT NULL AND week_start <= ?'
    )
    .get(throughWeek).n;
}

export function pulseCount(week) {
  return db.prepare('SELECT COUNT(*) AS n FROM pulse_responses WHERE week_start = ?').get(week).n;
}

export function lastImport() {
  return db.prepare('SELECT * FROM imports ORDER BY imported_at DESC, id DESC LIMIT 1').get() || null;
}

export function useCaseStats(team = null) {
  return db
    .prepare(
      `SELECT uc.id, uc.name, uc.product, uc.risk, uc.risk_note AS riskNote,
              COALESCE(SUM(p.minutes), 0) AS minutes,
              COUNT(DISTINCT p.employee_id) AS people
       FROM use_cases uc
       LEFT JOIN pulse_responses p ON p.use_case_id = uc.id
         AND (? IS NULL OR p.employee_id IN (SELECT id FROM employees WHERE team = ?))
       GROUP BY uc.id
       ORDER BY minutes DESC, uc.name`
    )
    .all(team, team)
    .map((r) => ({ ...r, hours: round1(r.minutes / 60) }));
}

export function champions() {
  const rows = db
    .prepare(
      `SELECT c.id AS championId, c.name AS championName, c.team AS championTeam, c.title AS championTitle,
              l.id AS learnerId, l.name AS learnerName, l.team AS learnerTeam, MIN(p.week_start) AS week
       FROM pulse_responses p
       JOIN employees c ON c.id = p.taught_by_id
       JOIN employees l ON l.id = p.employee_id
       GROUP BY c.id, l.id
       ORDER BY week`
    )
    .all();
  const byChampion = new Map();
  for (const r of rows) {
    if (!byChampion.has(r.championId)) {
      byChampion.set(r.championId, {
        id: r.championId,
        name: r.championName,
        team: r.championTeam,
        title: r.championTitle,
        learners: [],
      });
    }
    byChampion.get(r.championId).learners.push({ id: r.learnerId, name: r.learnerName, team: r.learnerTeam, week: r.week });
  }
  return [...byChampion.values()].sort((a, b) => b.learners.length - a.learners.length || a.name.localeCompare(b.name));
}

export function teamSeries() {
  const weeks = recentWeeks();
  const series = TEAMS.map((team) => ({ team, values: [], active: [], total: 0 }));
  for (const week of weeks) {
    for (const t of teamAdoption(week)) {
      const s = series.find((x) => x.team === t.team);
      s.values.push(t.pct);
      s.active.push(t.active);
      s.total = t.total;
    }
  }
  const overall = weeks.map((w) => adoption(w).pct);
  return { weeks, series, overall };
}

// Use cases a team has saved time on, most minutes first.
function teamUseCases(team) {
  return useCaseStats(team).filter((u) => u.minutes > 0);
}

// Closest champion to a team: someone on the team first, then a team doing similar work
// (most shared use cases), then the top champion overall. Returns the champion and a one-line reason.
export function suggestChampion(team, all = champions()) {
  if (!all.length) return null;
  const pick = (c, reason) => ({ id: c.id, name: c.name, team: c.team, helped: c.learners.length, reason });
  const helpedText = (c) => `${c.learners.length} ${c.learners.length === 1 ? 'colleague' : 'colleagues'}`;

  const sameTeam = all.find((c) => c.team === team);
  if (sameTeam) return pick(sameTeam, `On the ${team} team and has helped ${helpedText(sameTeam)} start.`);

  const ours = teamUseCases(team);
  const similar = all
    .map((c) => {
      const theirs = new Set(teamUseCases(c.team).map((u) => u.id));
      return { c, shared: ours.filter((u) => theirs.has(u.id)) };
    })
    .filter((x) => x.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || b.c.learners.length - a.c.learners.length)[0];
  if (similar) {
    const work = inSentence(similar.shared[0].name);
    return pick(similar.c, `${similar.c.team} also uses AI for ${work}, like ${team}.`);
  }

  const top = all[0];
  return pick(top, `Top champion overall, with ${helpedText(top)} helped so far.`);
}

export function needsAttention(week = currentWeek()) {
  const teams = teamAdoption(week);
  const company = adoption(week);
  const lowest = [...teams].sort((a, b) => a.pct - b.pct || a.active - b.active)[0];
  const champion = suggestChampion(lowest.team);

  // Most-used, lowest-risk use case: prefer green ones this team already uses, else the top green one overall.
  const teamGreen = useCaseStats(lowest.team).filter((u) => u.risk === 'green' && u.minutes > 0);
  const allGreen = useCaseStats().filter((u) => u.risk === 'green');
  const useCase = teamGreen[0] || allGreen[0] || null;

  const neverTried = lowest.neverTried;
  const explanation =
    `${lowest.active} of ${lowest.total} people in ${lowest.team} used AI this week, compared with ${company.pct}% across the company.` +
    (neverTried > 0 ? ` ${neverTried} ${neverTried === 1 ? 'has' : 'have'} never tried it.` : '');

  // Never say a champion has offered or agreed to anything: the lead decides how much to ask of them.
  const nextStep = useCase
    ? `Help ${lowest.team} start with ${inSentence(useCase.name)}, the most used low-risk use case. ` +
      (champion
        ? `${champion.name} is the closest champion. You can ask them to share their approach, run a short session yourself, or share a recipe with the team.`
        : 'Run a short hands-on session or share a starter prompt with the team.')
    : `Run a short hands-on session for ${lowest.team}.`;

  return {
    team: lowest,
    companyPct: company.pct,
    recipe: recipeFor(champion, useCase),
    explanation,
    nextStep,
    champion,
    useCase: useCase ? { id: useCase.id, name: useCase.name, risk: useCase.risk, riskNote: useCase.riskNote } : null,
    needsAttention: lowest.pct < company.pct - 15,
  };
}

// The champion's own saved prompt for this use case, credited to them, but only if they marked it OK to share.
// Otherwise the playbook's starter recipe, credited to no one. A private prompt's text never leaves here;
// savedPrivate only lets "Ask a champion" ask whether they would share it.
export function recipeFor(champion, useCase) {
  const starter = starterRecipe(useCase?.name);
  const saved =
    champion && useCase
      ? db
          .prepare('SELECT prompt, shareable FROM recipes WHERE employee_id = ? AND use_case_id = ?')
          .get(champion.id, useCase.id)
      : null;
  if (saved?.shareable) {
    return { source: 'champion', author: champion.name, authorTeam: champion.team, prompt: saved.prompt, tip: starter.tip, savedPrivate: false };
  }
  return { source: 'starter', author: null, authorTeam: null, prompt: starter.prompt, tip: starter.tip, savedPrivate: Boolean(saved) };
}

// Champions credited in this week's pulse, with who they helped and on what.
export function weekChampions(week = currentWeek()) {
  const rows = db
    .prepare(
      `SELECT c.name AS champion, c.team AS championTeam, l.name AS learner, l.team AS learnerTeam, uc.name AS useCase
       FROM pulse_responses p
       JOIN employees c ON c.id = p.taught_by_id
       JOIN employees l ON l.id = p.employee_id
       LEFT JOIN use_cases uc ON uc.id = p.use_case_id
       WHERE p.week_start = ?
       ORDER BY c.name, l.name`
    )
    .all(week);
  const byChampion = new Map();
  for (const r of rows) {
    if (!byChampion.has(r.champion)) byChampion.set(r.champion, { name: r.champion, team: r.championTeam, helped: [] });
    byChampion.get(r.champion).helped.push({ name: r.learner, team: r.learnerTeam, useCase: r.useCase });
  }
  return [...byChampion.values()];
}

export function headline(week = currentWeek()) {
  const now = adoption(week);
  const prev = adoption(addDays(week, -7));
  const diff = now.pct - prev.pct;
  const trend =
    diff > 0 ? `Adoption is up to ${now.pct}%.` : diff < 0 ? `Adoption is down to ${now.pct}%.` : `Adoption is holding at ${now.pct}%.`;
  const attention = needsAttention(week);
  const tail = attention.needsAttention ? ` ${attention.team.team} needs attention.` : ' Every team is close to the company average.';
  return trend + tail;
}

export function overview() {
  const week = currentWeek();
  const prevWeek = addDays(week, -7);
  const now = adoption(week);
  const prev = adoption(prevWeek);
  const hoursNow = hoursSaved(week);
  const hoursPrev = hoursSaved(prevWeek);
  const taughtNow = peopleTaught(week);
  const taughtPrev = peopleTaught(prevWeek);
  const imp = lastImport();

  return {
    week,
    weekLabel: formatWeek(week),
    headline: headline(week),
    sources: {
      lastImportAt: imp ? imp.imported_at : null,
      lastImportFile: imp ? imp.filename : null,
      pulseResponses: pulseCount(week),
      employees: now.total,
    },
    tiles: {
      adoption: { value: now.pct, active: now.active, total: now.total, change: now.pct - prev.pct },
      hours: { value: hoursNow, change: round1(hoursNow - hoursPrev) },
      taught: { value: taughtNow, change: taughtNow - taughtPrev },
    },
    attention: needsAttention(week),
  };
}

// Compact facts for the leadership update prompt and its demo fallback.
export function leadershipFacts() {
  const o = overview();
  const week = o.week;
  const teams = teamAdoption(week);
  const teamsPrev = teamAdoption(addDays(week, -7));
  const topUseCases = useCaseStats().slice(0, 3);
  const champs = champions().slice(0, 3);
  return {
    weekLabel: o.weekLabel,
    adoption: o.tiles.adoption,
    hours: o.tiles.hours,
    taught: o.tiles.taught,
    pulseResponses: o.sources.pulseResponses,
    teams: teams.map((t) => ({ ...t, change: t.pct - (teamsPrev.find((p) => p.team === t.team)?.pct ?? 0) })),
    topUseCases: topUseCases.map((u) => ({ name: u.name, hours: u.hours, risk: u.risk })),
    topChampionsOverall: champs.map((c) => ({ name: c.name, team: c.team, helped: c.learners.length })),
    championsThisWeek: weekChampions(week),
    attention: {
      team: o.attention.team.team,
      explanation: o.attention.explanation,
      nextStep: o.attention.nextStep,
    },
  };
}

export function employeeImpact(employeeId) {
  const employee = db.prepare('SELECT id, name, email, team, title FROM employees WHERE id = ?').get(employeeId);
  if (!employee) return null;
  const week = currentWeek();
  const month = week.slice(0, 7);
  const monthLabel = new Date(`${week}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const monthMinutes = db
    .prepare(`SELECT COALESCE(SUM(minutes), 0) AS m FROM pulse_responses WHERE employee_id = ? AND substr(week_start, 1, 7) = ?`)
    .get(employeeId, month).m;
  const totalMinutes = db
    .prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM pulse_responses WHERE employee_id = ?')
    .get(employeeId).m;

  const byUseCase = db
    .prepare(
      `SELECT uc.name, uc.risk, SUM(p.minutes) AS minutes
       FROM pulse_responses p JOIN use_cases uc ON uc.id = p.use_case_id
       WHERE p.employee_id = ? AND substr(p.week_start, 1, 7) = ?
       GROUP BY uc.id ORDER BY minutes DESC`
    )
    .all(employeeId, month)
    .map((r) => ({ ...r, hours: round1(r.minutes / 60) }));

  const helped = db
    .prepare(
      `SELECT l.name, l.team, MIN(p.week_start) AS week
       FROM pulse_responses p JOIN employees l ON l.id = p.employee_id
       WHERE p.taught_by_id = ? GROUP BY l.id ORDER BY week`
    )
    .all(employeeId);

  const wins = db
    .prepare(
      `SELECT p.week_start AS week, p.win_text AS text, uc.name AS useCase
       FROM pulse_responses p LEFT JOIN use_cases uc ON uc.id = p.use_case_id
       WHERE p.employee_id = ? AND p.win_text IS NOT NULL AND trim(p.win_text) != ''
       ORDER BY p.week_start DESC`
    )
    .all(employeeId);

  const weeksAnswered = db.prepare('SELECT COUNT(*) AS n FROM pulse_responses WHERE employee_id = ?').get(employeeId).n;
  const thisWeek = db
    .prepare('SELECT saved_time AS savedTime, minutes FROM pulse_responses WHERE employee_id = ? AND week_start = ?')
    .get(employeeId, week);

  return {
    employee,
    week,
    monthLabel,
    monthHours: round1(monthMinutes / 60),
    totalHours: round1(totalMinutes / 60),
    byUseCase,
    helped,
    wins,
    weeksAnswered,
    answeredThisWeek: Boolean(thisWeek),
  };
}
