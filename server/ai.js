// Claude API wrapper. Runs on the server only; the API key never reaches the browser.
// Demo mode: with no ANTHROPIC_API_KEY (or if a call fails), every feature returns
// realistic sample text built from the real numbers instead of an error.
import Anthropic from '@anthropic-ai/sdk';
import { inSentence } from './metrics.js';

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

const demoTurn = { leadership: 0 };

const signed = (n, unit = '') => `${n > 0 ? '+' : ''}${n}${unit}`;

function riskLine(facts) {
  if (!facts.riskNote) return '';
  const note = facts.riskNote.replace(/\.$/, '');
  const lead = facts.risk === 'green' ? 'It is a low-risk place to start' : 'One thing to keep in mind';
  return `${lead}: ${note.charAt(0).toLowerCase()}${note.slice(1)}.`;
}

// Starter prompt and one-line tip per use case. Grounds the "Run it yourself" and
// "Share the recipe" drafts, live or demo, so the model never invents a recipe.
const STARTER_RECIPES = {
  'Call notes and follow-up emails': {
    prompt: 'Here are my rough notes from a call with [customer]. Turn them into a short recap email with the decisions, next steps and owners. Keep it under 150 words.',
    tip: 'Paste your notes right after the call while the details are fresh, then read the draft once before sending.',
  },
  'Account research briefs': {
    prompt: 'Using only public information, write a one-page brief on [company]: what they do, recent news, likely priorities and three questions to ask them.',
    tip: 'Check each fact against its source before you rely on it.',
  },
  'FlowOS support ticket summaries': {
    prompt: 'Summarize this FlowOS ticket thread in five bullets: the problem, what has been tried, current status, open questions and who owns the next step.',
    tip: 'Remove customer names and personal details first, and use the approved workspace.',
  },
  'Campaign copy drafts': {
    prompt: 'Write three versions of [asset] for [audience] about [feature]. Keep each under 60 words and give each a different angle.',
    tip: 'Ask for three options, pick the strongest, then edit it in your own voice.',
  },
  'Insight report narratives': {
    prompt: 'Turn these Insight metrics into a short plain-language summary for a customer executive: what changed, why it matters and one recommendation.',
    tip: 'Check every number against the source report before you send it.',
  },
  'Contract and pricing review': {
    prompt: 'List the clauses in this contract that cover renewal, pricing changes and termination, and quote each one in full.',
    tip: 'Use it to find clauses faster, then send anything important to legal.',
  },
  'Process documentation': {
    prompt: 'I will describe a task I do regularly. Turn it into a numbered step-by-step guide a new hire could follow, then list anything I left unclear as questions.',
    tip: 'Talk it through as if you were explaining it to a new colleague, then answer the questions it asks.',
  },
};

const GENERIC_RECIPE = {
  prompt: 'Here is a task I do every week: [describe it]. Suggest a first draft I can edit, and tell me what extra information would make it better.',
  tip: 'Start with a low-risk internal task and read every draft before you use it.',
};

export function starterRecipe(useCase) {
  return STARTER_RECIPES[useCase] || GENERIC_RECIPE;
}

const NO_CLAIMS =
  'Never say or imply that the champion has offered, agreed, volunteered or committed to anything. ';

const NEXT_STEP_INSTRUCTIONS = {
  ask: (f) =>
    `Draft a short, low-pressure note (under 80 words) from the AI enablement lead to ${f.champion}, an AI champion on the ${f.championTeam} team. ` +
    `Ask whether they would be willing to share their approach to ${inSentence(f.useCase)} so the ${f.team} team can get started. ` +
    'Keep the ask small, say it will be credited to them by name, and make it easy to say no, with no reason needed. ' +
    NO_CLAIMS +
    `Start with "Hi ${f.championFirst}," and end with a sign-off from AI Enablement. Plain text only.`,
  run: (f) =>
    `Draft a short invite (under 90 words) from the AI enablement lead to the ${f.team} team for a 15 minute session that the lead runs. ` +
    `It covers ${inSentence(f.useCase)} using the starter recipe in the data, ` +
    (f.champion ? `and credits ${f.champion} (${f.championTeam}) by name for the recipe. ` : 'credited to our AI champions. ') +
    'Make it practical: bring one real task, leave with a draft. Mention the risk guidance in one short clause. ' +
    NO_CLAIMS +
    'Start with a greeting line and end with a sign-off from AI Enablement. Plain text only.',
  share: (f) =>
    `Draft a short message (under 100 words) from the AI enablement lead to the ${f.team} team sharing a prompt for ${inSentence(f.useCase)}. ` +
    'Include the starter recipe prompt from the data on its own line, lightly adapted if helpful, followed by a one-line tip starting with "Tip:". ' +
    (f.champion ? `Credit ${f.champion} (${f.championTeam}) by name. ` : '') +
    NO_CLAIMS +
    'Start with a greeting line and end with a sign-off from AI Enablement. Plain text only.',
};

const NEXT_STEP_DEMOS = {
  ask: (f) => [
    [
      `Hi ${f.championFirst},`,
      '',
      `${f.team} is just getting started with AI, and ${inSentence(f.useCase)} looks like an easy first step for them. You have helped ${f.helpedText} get going, so I wondered if you would be open to sharing how you approach it.`,
      '',
      'Even just the prompt you use and one tip would be plenty. I can do the rest, and it will be credited to you by name.',
      '',
      'No pressure at all. If you are busy or would rather not, just reply "not now" and that is completely fine.',
      '',
      'Thanks,',
      'AI Enablement',
    ],
    [
      `Hi ${f.championFirst},`,
      '',
      `A quick question with no obligation attached. ${f.team} is starting out with AI and I would like to begin with ${inSentence(f.useCase)}. Would you be willing to share the prompt or approach that works for you?`,
      '',
      'A few lines in a reply is enough. I will turn it into something the team can use and credit it to you by name.',
      '',
      'If now is not a good time, a simple no is completely fine.',
      '',
      'Thanks,',
      'AI Enablement',
    ],
  ],
  run: (f) => [
    [
      `Hi ${f.team} team,`,
      '',
      `I am running a 15 minute session on ${inSentence(f.useCase)}, the most used low-risk way people at Northstar are saving time with AI. ${f.credit ? `We will use a recipe from ${f.credit}, so thanks to ${f.championFirst} for the approach.` : ''}`.trim(),
      '',
      `Bring one task you do regularly. You will leave with a first draft and a prompt you can reuse. ${riskLine(f)}`.trim(),
      '',
      'Reply with a time that suits you and I will send a calendar invite.',
      '',
      'Thanks,',
      'AI Enablement',
    ],
    [
      `Hi ${f.team} team,`,
      '',
      `Got 15 minutes? I will walk through a simple way to use AI for ${inSentence(f.useCase)}${f.credit ? `, based on a recipe from ${f.credit}` : ''}.`,
      '',
      `No prep and no experience needed. Bring one real task and leave with a draft you can use. ${riskLine(f)}`.trim(),
      '',
      'Reply with a time that works and I will send a calendar invite.',
      '',
      'Thanks,',
      'AI Enablement',
    ],
  ],
  share: (f) => [
    [
      `Hi ${f.team} team,`,
      '',
      `Here is a prompt to try for ${inSentence(f.useCase)}${f.credit ? `, with credit to ${f.credit} for the recipe` : ''}. Paste it into the approved AI tool and fill in the brackets:`,
      '',
      f.recipe.prompt,
      '',
      `Tip: ${f.recipe.tip}`,
      '',
      'Thanks,',
      'AI Enablement',
    ],
    [
      `Hi ${f.team} team,`,
      '',
      `One quick thing to try this week. This prompt for ${inSentence(f.useCase)} comes from a recipe by ${f.credit || 'our AI champions'}:`,
      '',
      f.recipe.prompt,
      '',
      `Tip: ${f.recipe.tip}`,
      '',
      'Reply if you get stuck and I will help.',
      '',
      'Thanks,',
      'AI Enablement',
    ],
  ],
};

export function draftNextStep(kind, facts) {
  const f = {
    ...facts,
    championFirst: facts.champion?.split(' ')[0] ?? '',
    credit: facts.champion ? `${facts.champion} in ${facts.championTeam}` : '',
    helpedText: `${facts.helped} ${facts.helped === 1 ? 'colleague' : 'colleagues'}`,
  };
  return withFallback(NEXT_STEP_INSTRUCTIONS[kind](f), facts, () => {
    // Alternate phrasings so Draft again visibly does something in demo mode.
    demoTurn[kind] = (demoTurn[kind] || 0) + 1;
    const variants = NEXT_STEP_DEMOS[kind](f);
    return variants[(demoTurn[kind] - 1) % variants.length].join('\n');
  });
}

// "Maya Chen (Sales) helped Sam Carter with call notes and follow-up emails, and ..."
function championsLine(list) {
  const parts = list.map((c) => {
    const helped = c.helped.map((h) => (h.useCase ? `${h.name} with ${inSentence(h.useCase)}` : `${h.name} get started`));
    return `${c.name} (${c.team}) helped ${joinAnd(helped)}`;
  });
  if (parts.length < 3) return parts.join(', and ');
  return `${parts.slice(0, -1).join('; ')}; and ${parts[parts.length - 1]}`;
}

function joinAnd(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0];
}

export function leadershipUpdate(facts) {
  const instruction =
    'Write a weekly leadership update about the AI rollout as exactly four bullet points, each starting with "- ". ' +
    'Bullet 1: adoption and its change. Bullet 2: impact in hours saved and the top use cases. ' +
    'Bullet 3: name each of this week\'s champions from championsThisWeek and who and what they helped with; if the list is empty, say no one was credited as a champion this week. ' +
    'Bullet 4: the team that needs attention and the planned next step. Each bullet is one or two sentences. ' +
    'Never say a champion has offered or agreed to run anything. No intro or outro.';
  return withFallback(instruction, facts, () => {
    const top = facts.topUseCases.map((u) => inSentence(u.name));
    const topText = `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
    const best = [...facts.teams].sort((a, b) => b.pct - a.pct)[0];
    const step = facts.attention.nextStep.split('. ')[0];
    const champs = championsLine(facts.championsThisWeek);
    // Two phrasings so Regenerate visibly does something in demo mode.
    const variants = [
      [
        `- ${facts.adoption.active} of ${facts.adoption.total} people used AI in the week of ${facts.weekLabel} (${facts.adoption.value}%, ${signed(facts.adoption.change)} points vs last week), led by ${best.team} at ${best.pct}%.`,
        `- People reported ${facts.hours.value} hours saved this week (${signed(facts.hours.change)} vs last week) across ${facts.pulseResponses} pulse responses. Most of the time came from ${topText}.`,
        `- ${champs ? `Champions this week: ${champs}.` : 'No one was credited as a champion this week.'}`,
        `- ${facts.attention.explanation} Next step: ${step}.`,
      ],
      [
        `- Adoption reached ${facts.adoption.value}% this week, ${facts.adoption.active} of ${facts.adoption.total} people, a change of ${signed(facts.adoption.change)} points. ${best.team} leads at ${best.pct}%.`,
        `- ${facts.pulseResponses} people answered the pulse and reported ${facts.hours.value} hours saved. ${facts.taught.value} people have now been taught by a colleague, ${signed(facts.taught.change)} this week.`,
        `- ${champs ? `Thanks to this week's champions: ${champs}.` : 'No new champion credits came in this week.'}`,
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
    const uses = record.topUseCases.map((u) => inSentence(u.name));
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
