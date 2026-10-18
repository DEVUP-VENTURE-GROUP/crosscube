import type { Issue } from "@/modules/invoices/invoice.types";

export function issueMap(issues: readonly Issue[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const issue of [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1))) {
    if (!map.has(issue.path)) map.set(issue.path, issue.message);
  }
  return map;
}

export function IssueList({ issues }: { issues: readonly Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm" data-testid="issue-list">
      {issues.map((issue, index) => (
        <li key={`${issue.path}-${index}`} className="flex gap-2">
          <span
            aria-hidden="true"
            className={`mt-1.5 size-2 shrink-0 rounded-full ${issue.severity === "error" ? "bg-red-500" : "bg-amber-400"}`}
          />
          <span className={issue.severity === "error" ? "text-red-800" : "text-amber-900"}>
            <span className="sr-only">{issue.severity === "error" ? "Error: " : "Warning: "}</span>
            {issue.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
