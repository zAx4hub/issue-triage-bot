import { describe, it, expect } from "vitest";
import { jaccard, suggestLabels, triageIssue, run, demo, inspect } from "../src/engine";

describe("issue-triage-bot", () => {
  it("jaccard identical", () => expect(jaccard("a b c", "a b c")).toBe(1));
  it("suggests security label", () => {
    expect(suggestLabels("xss auth token leak")).toContain("security");
  });
  it("triages p0 for production down", () => {
    const t = triageIssue({ title: "production down", body: "sev-1 outage" });
    expect(t.priority).toBe("p0");
    expect(t.slaHours).toBe(4);
  });
  it("demo + inspect", () => {
    expect(demo().findings.length).toBe(3);
    expect(inspect().features).toContain("duplicates");
    expect(run({}).author).toContain("zAx4hub");
  });
});
