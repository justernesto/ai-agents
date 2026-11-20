import catalog from "../lib/runbooks.json";

export const MAX_MESSAGE_LENGTH = 1200;
export const MAX_HISTORY_MESSAGES = 6;

export type Mode = "demo" | "gemini";

export type Source = {
  id: string;
  title: string;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Reply = {
  reply: string;
  mode: Mode;
  sources: Source[];
};

export const samples = [
  {
    id: "connectivity",
    code: "NET",
    scenario: "Office Wi-Fi can’t reach internal apps",
    prompt: "A user on office Wi-Fi can’t reach any internal apps. Where do I start?",
  },
  {
    id: "dns",
    code: "DNS",
    scenario: "An IP works but the hostname fails",
    prompt: "A laptop can reach an internal service by IP, but the hostname fails. What should I check?",
  },
  {
    id: "identity",
    code: "MFA",
    scenario: "A replacement phone blocks sign-in",
    prompt: "A user replaced their phone and can’t complete MFA. How should I triage it safely?",
  },
  {
    id: "handoff",
    code: "TKT",
    scenario: "An unresolved incident needs a handoff",
    prompt: "Help me prepare a handoff for an unresolved site connectivity issue.",
  },
];

export const runbooks = catalog;
export type Runbook = (typeof runbooks)[number];

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const runbookTerms = runbooks.map((runbook) => ({
  runbook,
  terms: [...new Set(runbook.keywords.map(normalize))].map((term) => ({
    term: ` ${term} `,
    length: term.split(" ").length,
  })),
}));

function bestMatch(message: string): Runbook | undefined {
  const input = ` ${normalize(message)} `;
  let match: Runbook | undefined;
  let bestLength = 0;
  let bestCount = 0;
  for (const { runbook, terms } of runbookTerms) {
    const matches = terms.filter(({ term }) => input.includes(term));
    if (!matches.length) continue;
    if (runbook.id === "handoff") return runbook;

    const longest = Math.max(...matches.map(({ length }) => length));
    if (longest > bestLength || (longest === bestLength && matches.length > bestCount)) {
      match = runbook;
      bestLength = longest;
      bestCount = matches.length;
    }
  }
  return match;
}

export function browserReply(message: string, history: readonly ConversationMessage[]): Reply {
  let runbook = bestMatch(message);
  const followUp = /\b(?:what next|next step|still failing|still broken|it still|same error|already tried|what else)\b/;
  if (!runbook && followUp.test(normalize(message))) {
    for (const turn of [...history].reverse()) {
      if (turn.role !== "user") continue;
      runbook = bestMatch(turn.content);
      if (runbook) break;
    }
  }

  if (!runbook) {
    return {
      mode: "demo",
      sources: [],
      reply: "I couldn’t match that to a runbook. What service or device stopped working, what error do you see, and is one person or a wider group affected?",
    };
  }

  const checks = runbook.checks.map((step, index) => `${index + 1}. ${step.text}`).join("\n");
  return {
    mode: "demo",
    sources: [{ id: runbook.id, title: runbook.title }],
    reply: `${runbook.summary}\n\n${checks}\n\nFor the handoff: ${runbook.handoff}`,
  };
}
