import { Router } from 'express';
import { draftInvite, leadershipUpdate, reviewSummary } from '../ai.js';
import { employeeImpact, leadershipFacts, needsAttention } from '../metrics.js';

const router = Router();

router.post('/invite', async (req, res, next) => {
  try {
    const a = needsAttention();
    const facts = {
      team: a.team.team,
      teamActive: a.team.active,
      teamTotal: a.team.total,
      neverTried: a.team.neverTried,
      champion: a.champion?.name ?? 'one of our AI champions',
      championTeam: a.champion?.team ?? null,
      helped: a.champion?.helped ?? 0,
      useCase: a.useCase?.name ?? 'everyday drafting',
      risk: a.useCase?.risk ?? null,
      riskNote: a.useCase?.riskNote ?? '',
    };
    res.json(await draftInvite(facts));
  } catch (err) {
    next(err);
  }
});

// Cache the summary per data snapshot so page loads don't call the API again; Regenerate passes fresh.
const leadershipCache = new Map();

router.post('/leadership-update', async (req, res, next) => {
  try {
    const facts = leadershipFacts();
    const key = JSON.stringify(facts);
    if (!req.body?.fresh && leadershipCache.has(key)) return res.json(leadershipCache.get(key));
    const result = await leadershipUpdate(facts);
    leadershipCache.clear();
    leadershipCache.set(key, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/review-summary', async (req, res, next) => {
  try {
    const impact = employeeImpact(Number(req.body?.employeeId));
    if (!impact) return res.status(404).json({ error: 'Employee not found.' });
    const record = {
      name: impact.employee.name,
      title: impact.employee.title,
      team: impact.employee.team,
      monthLabel: impact.monthLabel,
      monthHours: impact.monthHours,
      totalHours: impact.totalHours,
      weeksAnswered: impact.weeksAnswered,
      topUseCases: impact.byUseCase.slice(0, 3).map((u) => ({ name: u.name, hours: u.hours })),
      colleaguesHelped: impact.helped.length,
      wins: impact.wins.slice(0, 3).map((w) => w.text),
    };
    res.json(await reviewSummary(record));
  } catch (err) {
    next(err);
  }
});

export default router;
