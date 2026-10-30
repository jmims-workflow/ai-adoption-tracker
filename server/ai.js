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

const NO_CLAIMS =
  'Never say or imply that the champion has offered, agreed, volunteered or committed to anything. ';

// Credit follows the recipe: a champion's own saved prompt is credited to them by name;
// the playbook's starter recipe is labeled "Starter recipe" and credited to no one.
const RECIPE_RULES = {
  champion: (f) =>
    `The recipe prompt in the data is ${f.champion}'s own prompt, saved in their weekly pulse. Quote it exactly as given and credit it to ${f.champion} by name. `,
  starter: (f) =>
    'The recipe prompt in the data is the starter recipe from the enablement playbook. Quote it exactly as given and call it the "Starter recipe". ' +
    `Do not credit the recipe or tip to anyone${f.champion ? `, and do not say or imply it came from ${f.champion}` : ''}. `,
};

const NEXT_STEP_INSTRUCTIONS = {
  ask: (f) =>
    `Draft a short, low-pressure note (under 80 words) from the AI enablement lead to ${f.champion}, an AI champion on the ${f.championTeam} team. ` +
    (f.own
      ? `They saved a prompt for ${inSentence(f.useCase)} in their weekly pulse. Ask whether they would be happy for it to be shared with the ${f.team} team, credited to them by name, with nothing else needed from them. Do not quote the prompt. `
      : `Ask whether they would be willing to share their approach to ${inSentence(f.useCase)} so the ${f.team} team can get started. Keep the ask small and say it would be credited to them by name. `) +
    'Make it easy to say no, with no reason needed. ' +
    NO_CLAIMS +
    `Start with "Hi ${f.championFirst}," and end with a sign-off from AI Enablement. Plain text only.`,
  run: (f) =>
    `Draft a short invite (under 90 words) from the AI enablement lead to the ${f.team} team for a 15 minute session that the lead runs on ${inSentence(f.useCase)}, using the recipe in the data. ` +
    RECIPE_RULES[f.recipe.source](f) +
    (!f.own && f.champion
      ? `You may thank ${f.champion} (${f.championTeam}) for being a good example of this use case, but not for the recipe. `
      : '') +
    'Make it practical: bring one real task, leave with a draft. Mention the risk guidance in one short clause. ' +
    NO_CLAIMS +
    'Start with a greeting line and end with a sign-off from AI Enablement. Plain text only.',
  share: (f) =>
    `Draft a short message (under 100 words) from the AI enablement lead to the ${f.team} team sharing a prompt for ${inSentence(f.useCase)}. ` +
    RECIPE_RULES[f.recipe.source](f) +
    (f.own ? 'Put the prompt on its own line. ' : 'Put the label "Starter recipe:" on its own line, then the prompt on the next line. ') +
    'Follow it with the tip from the data on one line starting with "Tip:". ' +
    NO_CLAIMS +
    'Start with a greeting line and end with a sign-off from AI Enablement. Plain text only.',
};

const NEXT_STEP_DEMOS = {
  ask: (f) =>
    f.own
      ? [
          [
            `Hi ${f.championFirst},`,
            '',
            `Thank you for saving your prompt for ${inSentence(f.useCase)} in the weekly pulse. ${f.team} is just getting started with AI, and I think it could really help them.`,
            '',
            'Would you be happy for me to share it with the team? It would be credited to you by name, and you would not need to do anything else.',
            '',
            'If you would rather keep it to yourself, just reply "not now" and that is completely fine.',
            '',
            'Thanks,',
            'AI Enablement',
          ],
          [
            `Hi ${f.championFirst},`,
            '',
            `A quick question with no obligation attached. You saved a prompt for ${inSentence(f.useCase)} in your weekly pulse, and it looks like a good fit for ${f.team}, who are starting out with AI.`,
            '',
            'Are you OK with me sharing it with the team, credited to you by name? A one-word reply is plenty.',
            '',
            'If you would prefer not, a simple no is completely fine.',
            '',
            'Thanks,',
            'AI Enablement',
          ],
        ]
      : [
          [
            `Hi ${f.championFirst},`,
            '',
            `${f.team} is just getting started with AI, and ${inSentence(f.useCase)} looks like an easy first step for them. You have helped ${f.helpedText} get going, so I wondered if you would be open to sharing how you approach it.`,
            '',
            'Even just the prompt you use and one tip would be plenty. I can do the rest, and it would be credited to you by name.',
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
  run: (f) => {
    // Own recipe: credit it. Starter recipe: say so, and thank the champion only as an example.
    const source = f.own
      ? `We will use a recipe from ${f.credit}, so thanks to ${f.championFirst} for the prompt.`
      : 'We will work from the starter recipe in our playbook.';
    const example = !f.own && f.champion ? ` Thanks to ${f.credit} for being a good example of this kind of work.` : '';
    return [
      [
        `Hi ${f.team} team,`,
        '',
        `I am running a 15 minute session on ${inSentence(f.useCase)}, the most used low-risk way people at Northstar are saving time with AI. ${source}${example}`,
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
        `Got 15 minutes? I will walk through a simple way to use AI for ${inSentence(f.useCase)}, ${f.own ? `based on a recipe from ${f.credit}` : 'using a starter recipe from our playbook'}.${example}`,
        '',
        `No prep and no experience needed. Bring one real task and leave with a draft you can use. ${riskLine(f)}`.trim(),
        '',
        'Reply with a time that works and I will send a calendar invite.',
        '',
        'Thanks,',
        'AI Enablement',
      ],
    ];
  },
  share: (f) => {
    const recipe = f.own ? [f.recipe.prompt] : ['Starter recipe:', f.recipe.prompt];
    const paste = f.own
      ? 'Paste it into the approved AI tool and adapt it to your task:'
      : 'Paste it into the approved AI tool and adapt it to your task.';
    return [
      [
        `Hi ${f.team} team,`,
        '',
        `Here is a prompt to try for ${inSentence(f.useCase)}${f.own ? `, from ${f.credit}` : ''}. ${paste}`,
        '',
        ...recipe,
        '',
        `Tip: ${f.recipe.tip}`,
        '',
        'Thanks,',
        'AI Enablement',
      ],
      [
        `Hi ${f.team} team,`,
        '',
        f.own
          ? `One quick thing to try this week. This prompt for ${inSentence(f.useCase)} comes from ${f.credit}:`
          : `One quick thing to try this week, for ${inSentence(f.useCase)}.`,
        '',
        ...recipe,
        '',
        `Tip: ${f.recipe.tip}`,
        '',
        'Reply if you get stuck and I will help.',
        '',
        'Thanks,',
        'AI Enablement',
      ],
    ];
  },
};

export function draftNextStep(kind, facts) {
  const f = {
    ...facts,
    own: facts.recipe.source === 'champion',
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
