// The enablement playbook: a starter prompt and one-line tip per use case.
// Used when the suggested champion has not saved their own prompt, labeled "Starter recipe"
// and never credited to anyone. The tip is used with champions' own prompts too.
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
