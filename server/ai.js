// Claude API wrapper. Runs on the server only; the API key never reaches the browser.
// Demo mode: with no ANTHROPIC_API_KEY (or if a call fails), every feature returns
// realistic sample text built from the real numbers instead of an error.
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const model = process.env.CLAUDE_MODEL?.trim() || 'claude-opus-5-5';
const client = apiKey ? new Anthropic({ apiKey }) : null;

export const aiMode = client ? 'live' : 'demo';

const SYSTEM = [
  'You write short internal workplace copy for Northstar Systems, a software company with three products: FlowOS, Connect and Insight.',
  'Write in plain, warm, specific language. Use only the numbers and names given in the data. Never invent figures.',
  'Do not use em dashes or en dashes. Use commas, periods or colons instead. Do not use emoji. Do not use markdown headings or bold text.',
].join(' ');

function cleanText(text) {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ', ')
    .replace(/\*\*/g, '')
    .trim();
}

async function generate(instruction, data, maxTokens = 1500) {
  if (!client) return null;
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `${instruction}\n\nData (JSON):\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return null;
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return text ? cleanText(text) : null;
  } catch (err) {
    console.warn(`Claude API call failed, using demo text instead: ${err.message}`);
    return null;
  }
}

async function withFallback(instruction, data, demoText, maxTokens) {
  const text = await generate(instruction, data, maxTokens);
  return text ? { text, demo: false } : { text: demoText(), demo: true };
}

const demoTurn = { leadership: 0, invite: 0 };

const signed = (n, unit = '') => `${n > 0 ? '+' : ''}${n}${unit}`;

function riskLine(facts) {
  if (!facts.riskNote) return '';
  const note = facts.riskNote.replace(/\.$/, '');
  const lead = facts.risk === 'green' ? 'It is a low-risk place to start' : 'One thing to keep in mind';
  return `${lead}: ${note.charAt(0).toLowerCase()}${note.slice(1)}.`;
}

export function draftInvite(facts) {
  const instruction =
    `Draft a short, friendly invite message (under 90 words) that the AI enablement lead can send to the ${facts.team} team. ` +
    `It invites them to a 30 minute hands-on session with ${facts.champion} on "${facts.useCase}". ` +
    'Make it feel low pressure and practical: bring one real task, leave with it done. Mention the risk guidance in one short clause. ' +
    'Start with a greeting line and end with a sign-off from the AI enablement team. Plain text only.';
  return withFallback(instruction, facts, () => {
    demoTurn.invite += 1;
    const first = demoTurn.invite % 2 === 1;
    return [
      `Hi ${facts.team} team,`,
      '',
      first
        ? `${facts.champion} has helped ${facts.helped} colleagues get real time back with AI, and has offered to run a 30 minute hands-on session for you on ${facts.useCase.toLowerCase()}.`
        : `Want to see how colleagues across Northstar are saving time each week? ${facts.champion} is hosting a relaxed 30 minute session on ${facts.useCase.toLowerCase()}, just for ${facts.team}.`,
      '',
      `Bring one real task from your week. You will leave with it done and a prompt you can reuse. ${riskLine(facts)}`,
      '',
      first
        ? 'No prep needed and no wrong questions. Reply to this message and we will find a time that works.'
        : 'No experience needed. Reply with a time that suits you and we will send a calendar invite.',
      '',
      'Thanks,',
      'AI Enablement',
    ].join('\n');
  });
}

export function leadershipUpdate(facts) {
  const instruction =
    'Write a weekly leadership update about the AI rollout as exactly three bullet points, each starting with "- ". ' +
    'Bullet 1: adoption and its change. Bullet 2: impact in hours saved and the top use cases. ' +
    'Bullet 3: the team that needs attention and the planned next step. Each bullet is one or two sentences. No intro or outro.';
  return withFallback(instruction, facts, () => {
    const top = facts.topUseCases.map((u) => u.name.toLowerCase());
    const topText = `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
    const best = [...facts.teams].sort((a, b) => b.pct - a.pct)[0];
    const step = facts.attention.nextStep.split('. ')[0];
    // Two phrasings so Regenerate visibly does something in demo mode.
    const variants = [
      [
        `- ${facts.adoption.active} of ${facts.adoption.total} people used AI in the week of ${facts.weekLabel} (${facts.adoption.value}%, ${signed(facts.adoption.change)} points vs last week), led by ${best.team} at ${best.pct}%.`,
        `- People reported ${facts.hours.value} hours saved this week (${signed(facts.hours.change)} vs last week) across ${facts.pulseResponses} pulse responses. Most of the time came from ${topText}.`,
        `- ${facts.attention.explanation} Next step: ${step}.`,
      ],
      [
        `- Adoption reached ${facts.adoption.value}% this week, ${facts.adoption.active} of ${facts.adoption.total} people, a change of ${signed(facts.adoption.change)} points. ${best.team} leads at ${best.pct}%.`,
        `- ${facts.pulseResponses} people answered the pulse and reported ${facts.hours.value} hours saved. ${facts.taught.value} people have now been taught by a colleague, ${signed(facts.taught.change)} this week.`,
        `- Focus for next week: ${facts.attention.team}. ${step}.`,
      ],
    ];
    demoTurn.leadership += 1;
    return variants[(demoTurn.leadership - 1) % variants.length].join('\n');
  });
}

export function reviewSummary(record) {
  const instruction =
    'Turn this employee\'s AI impact record into one short, review-ready paragraph (70 to 110 words) written in the first person, ' +
    'suitable for pasting into a performance self-review. Lead with time saved, name the main uses, mention colleagues helped if any, ' +
    'and reference one or two wins in concrete terms. Confident but not boastful. Plain text only.';
  return withFallback(instruction, record, () => {
    const uses = record.topUseCases.map((u) => u.name.toLowerCase());
    const usesText = uses.length > 1 ? `${uses.slice(0, -1).join(', ')} and ${uses[uses.length - 1]}` : uses[0] || 'everyday drafting';
    const parts = [
      `Across ${record.weeksAnswered} weekly ${record.weeksAnswered === 1 ? 'check-in' : 'check-ins'} I used AI tools to save about ${record.totalHours} hours of work (${record.monthHours} hours in ${record.monthLabel}), mainly on ${usesText}.`,
    ];
    if (record.colleaguesHelped > 0) {
      parts.push(
        `I also helped ${record.colleaguesHelped} ${record.colleaguesHelped === 1 ? 'colleague' : 'colleagues'} get started, sharing the workflows that worked for me.`
      );
    }
    if (record.wins.length) {
      const win = record.wins[0].replace(/\.$/, '');
      parts.push(`One example: ${win.charAt(0).toLowerCase()}${win.slice(1)}.`);
    }
    parts.push('I put the time back into higher-value work and plan to keep building on these habits next quarter.');
    return parts.join(' ');
  });
}
