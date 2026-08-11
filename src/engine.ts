/** issue-triage-bot — self-host triage by zAx4hub */
export type Issue = { id?: string; title: string; body?: string; labels?: string[]; author?: string };
export type Triage = {
  id: string;
  priority: "p0" | "p1" | "p2" | "p3";
  labels: string[];
  assigneeHint: string;
  duplicateOf?: string;
  slaHours: number;
  score: number;
  rationale: string[];
};
export type Report = {
  project: string;
  author: string;
  summary: string;
  score: number;
  findings: Triage[];
  metrics: Record<string, number>;
};

const LABEL_RULES: Array<{ label: string; words: string[] }> = [
  { label: "bug", words: ["crash", "error", "bug", "exception", "fail", "broken"] },
  { label: "feature", words: ["feature", "add", "support", "enhance", "request"] },
  { label: "docs", words: ["docs", "readme", "documentation", "typo"] },
  { label: "security", words: ["security", "xss", "cve", "auth", "token", "leak"] },
  { label: "performance", words: ["slow", "latency", "perf", "memory", "cpu"] },
];

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

export function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function suggestLabels(text: string): string[] {
  const toks = new Set(tokens(text));
  const out: Array<{ label: string; hits: number }> = [];
  for (const r of LABEL_RULES) {
    const hits = r.words.filter((w) => toks.has(w)).length;
    if (hits) out.push({ label: r.label, hits });
  }
  return out.sort((a, b) => b.hits - a.hits).map((x) => x.label);
}

export function priorityOf(text: string, labels: string[]): Triage["priority"] {
  const t = text.toLowerCase();
  if (labels.includes("security") || /prod(uction)?\s*down|data\s*loss|sev[- ]?1/.test(t)) return "p0";
  if (/crash|blocker|urgent|cannot|can't/.test(t)) return "p1";
  if (labels.includes("bug") || /broken|error/.test(t)) return "p2";
  return "p3";
}

const ROUTING: Record<string, string> = {
  security: "sec-oncall",
  bug: "eng-triage",
  feature: "product-intake",
  docs: "docs-team",
  performance: "perf-guild",
};

export function triageIssue(issue: Issue, corpus: Issue[] = []): Triage {
  const text = `${issue.title}\n${issue.body ?? ""}`;
  const labels = [...new Set([...(issue.labels ?? []), ...suggestLabels(text)])];
  const priority = priorityOf(text, labels);
  const slaHours = { p0: 4, p1: 24, p2: 72, p3: 168 }[priority];
  let duplicateOf: string | undefined;
  let best = 0;
  for (const other of corpus) {
    if (other.id && other.id === issue.id) continue;
    const sim = jaccard(text, `${other.title}\n${other.body ?? ""}`);
    if (sim > 0.55 && sim > best) {
      best = sim;
      duplicateOf = other.id ?? other.title.slice(0, 40);
    }
  }
  const score = Math.round(({ p0: 1, p1: 0.75, p2: 0.45, p3: 0.2 }[priority] + labels.length * 0.05) * 1000) / 1000;
  const assigneeHint = ROUTING[labels[0] ?? ""] ?? "eng-triage";
  const rationale = [
    `priority=${priority}`,
    `labels=${labels.join(",") || "none"}`,
    duplicateOf ? `possible duplicate of ${duplicateOf} (sim=${best.toFixed(2)})` : "no duplicate",
  ];
  return {
    id: issue.id ?? "issue",
    priority,
    labels,
    assigneeHint,
    duplicateOf,
    slaHours,
    score: Math.min(1, score),
    rationale,
  };
}

export function run(input: { issues?: Issue[]; corpus?: Issue[] } = {}): Report {
  const issues = input.issues?.length
    ? input.issues
    : [{ id: "1", title: "App crashes on login", body: "error exception broken auth" }];
  const findings = issues.map((i) => triageIssue(i, input.corpus ?? []));
  const avg = findings.reduce((a, f) => a + f.score, 0) / findings.length;
  return {
    project: "issue-triage-bot",
    author: "zAx4hub",
    summary: `Triaged ${findings.length} issues; p0=${findings.filter((f) => f.priority === "p0").length}`,
    score: Math.round(avg * 1000) / 1000,
    findings,
    metrics: {
      count: findings.length,
      duplicates: findings.filter((f) => f.duplicateOf).length,
      p0: findings.filter((f) => f.priority === "p0").length,
    },
  };
}

export function demo(): Report {
  return run({
    issues: [
      { id: "a", title: "Security token leak in logs", body: "auth token exposed CVE risk" },
      { id: "b", title: "Add dark mode feature", body: "feature request enhance UI" },
      { id: "c", title: "Security token leak again", body: "auth token exposed in logs CVE" },
    ],
    corpus: [
      { id: "a", title: "Security token leak in logs", body: "auth token exposed CVE risk" },
    ],
  });
}

export function inspect() {
  return {
    name: "issue-triage-bot",
    author: "zAx4hub",
    oneLiner: "Self-host triage engine",
    features: ["labels", "priority", "duplicates", "routing", "sla"],
    version: "0.1.0",
    commands: ["demo", "run", "inspect"],
  };
}
