import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  Play,
  Pause,
  Search,
  Download,
  Bookmark,
  Link2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  logInput,
  logErrorMessage,
  parseLogQuery,
  type LogInput,
  type LogEntry,
} from "@shared/logs";

const colors = {
  ERROR: "text-red-700 bg-red-50 border-red-200",
  WARNING: "text-amber-800 bg-amber-50 border-amber-200",
  INFO: "text-blue-700 bg-blue-50 border-blue-200",
};
const windowFor = (minutes: number) => ({
  start: new Date(Date.now() - minutes * 60000).toISOString(),
  end: new Date().toISOString(),
});
const formatTime = (value: string) => new Date(value).toLocaleString();
type Saved = { name: string; query: string };

function initialInput(): LogInput {
  const params = new URLSearchParams(window.location.search);
  const parsed = logInput.safeParse({
    query: params.get("query") ?? "",
    start: params.get("start") ?? windowFor(60).start,
    end: params.get("end") ?? windowFor(60).end,
  });
  return parsed.success ? parsed.data : { query: "", ...windowFor(60) };
}

export default function LogsExplorer() {
  const { user, organization } = useAuth();
  if (!user || !organization) return null;
  return (
    <Explorer
      key={`${user.id}:${organization.id}`}
      organizationId={organization.id}
      storageKey={`logs-queries:${user.id}:${organization.id}`}
    />
  );
}

function Explorer({
  organizationId,
  storageKey,
}: {
  organizationId: number;
  storageKey: string;
}) {
  const [applied, setApplied] = useState<LogInput>(initialInput);
  const [draft, setDraft] = useState(applied.query);
  const [range, setRange] = useState(() =>
    new URLSearchParams(window.location.search).has("start") ? "custom" : "60"
  );
  const [customStart, setCustomStart] = useState(applied.start.slice(0, -1));
  const [customEnd, setCustomEnd] = useState(applied.end.slice(0, -1));
  const [live, setLive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<NonNullable<LogInput["cursor"]>[]>([]);
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [library, setLibrary] = useState(false);
  const [saved, setSaved] = useState<Saved[]>(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "[]"
      );
      return Array.isArray(value)
        ? value
            .filter(
              (s): s is Saved =>
                typeof s?.name === "string" &&
                typeof s?.query === "string" &&
                s.query.length <= 2000
            )
            .slice(0, 30)
        : [];
    } catch {
      return [];
    }
  });
  const cursor = page ? history[page - 1] : undefined;
  const query = trpc.logs.search.useQuery(
    { ...applied, organizationId, cursor },
    { retry: false, refetchOnWindowFocus: false }
  );
  const data = query.data;

  function apply(input: LogInput) {
    try {
      parseLogQuery(input.query);
      const checked = logInput.parse(input);
      setApplied(checked);
      setPage(0);
      setHistory([]);
      setExpanded(null);
    } catch (e) {
      toast.error(logErrorMessage(e));
    }
  }

  function run() {
    setLive(false);
    try {
      const time =
        range === "custom"
          ? {
              start: new Date(`${customStart}Z`).toISOString(),
              end: new Date(`${customEnd}Z`).toISOString(),
            }
          : windowFor(Number(range));
      apply({ query: draft, ...time });
    } catch {
      toast.error("Enter a valid start and end time.");
    }
  }

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      setApplied(previous => ({ ...previous, ...windowFor(Number(range)) }));
      setPage(0);
      setHistory([]);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [live, range]);

  function filter(field: string, value: string) {
    try {
      const terms = parseLogQuery(draft).filter(t => t.field !== field);
      const next = [
        ...terms.map(t => `${t.field}=${JSON.stringify(t.value)}`),
        ...(value ? [`${field}=${JSON.stringify(value)}`] : []),
      ].join("\n");
      setDraft(next);
    } catch {
      toast.error("Fix the query syntax before adding a filter.");
    }
  }

  function saveQueries(next: Saved[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(next);
    } catch {
      toast.error("Browser storage is unavailable.");
    }
  }

  async function share() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      query: applied.query,
      start: applied.start,
      end: applied.end,
    }).toString();
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success(
        "Query link copied. Access still requires organization membership."
      );
    } catch {
      toast.error("Clipboard unavailable.");
    }
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { query: applied, entries: data?.entries ?? [] },
            null,
            2
          ),
        ],
        { type: "application/json" }
      )
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "harvey-logs.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function related(entry: LogEntry) {
    const next = entry.correlationId
      ? `correlationId=${JSON.stringify(entry.correlationId)}`
      : `taskId=${entry.taskId}`;
    setLive(false);
    setDraft(next);
    apply({ ...applied, query: next });
  }

  const maxBucket = Math.max(1, ...(data?.buckets.map(b => b.count) ?? []));
  const totalErrors =
    data?.facets
      .filter(f => f.severity === "ERROR")
      .reduce((sum, f) => sum + f.count, 0) ?? 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">
            Observability
          </div>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Activity className="h-7 w-7 text-primary" />
            Logs Explorer
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Explore execution events. Follow a task from start to finish.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLibrary(!library)}>
            <Bookmark className="h-4 w-4" /> Query library
          </Button>
          <Button variant="outline" onClick={share}>
            <Link2 className="h-4 w-4" /> Share query
          </Button>
        </div>
      </header>

      {library && (
        <section
          aria-label="Query library"
          className="rounded-xl border bg-card p-4 space-y-3"
        >
          <h2 className="font-semibold">
            Saved queries{" "}
            <span className="text-xs font-normal text-muted-foreground">
              Stored in this browser for your organization
            </span>
          </h2>
          <div className="flex gap-2">
            <Input
              aria-label="Query name"
              placeholder="Name this query"
              maxLength={80}
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <Button
              disabled={!name.trim() || saved.length >= 30}
              onClick={() => {
                try {
                  parseLogQuery(draft);
                  saveQueries([
                    ...saved.filter(s => s.name !== name.trim()),
                    { name: name.trim(), query: draft },
                  ]);
                  setName("");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Save current query
            </Button>
          </div>
          {saved.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No saved queries yet.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {saved.map(s => (
              <div key={s.name} className="flex rounded-md border">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(s.query);
                    setLive(false);
                  }}
                >
                  {s.name}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`Delete ${s.name}`}
                  onClick={() =>
                    saveQueries(saved.filter(x => x.name !== s.name))
                  }
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
        aria-label="Query editor"
      >
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <label className="grid gap-1 text-xs font-medium">
            Severity
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              defaultValue=""
              onChange={e => {
                filter("severity", e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Add severity filter</option>
              {["INFO", "WARNING", "ERROR"].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Source
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              defaultValue=""
              onChange={e => {
                filter("source", e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Add source filter</option>
              <option value="runtime">Runtime events</option>
              <option value="execution">Task execution</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Time range
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={range}
              onChange={e => {
                setRange(e.target.value);
                setLive(false);
              }}
            >
              <option value="15">Last 15 minutes</option>
              <option value="60">Last hour</option>
              <option value="360">Last 6 hours</option>
              <option value="1440">Last 24 hours</option>
              <option value="10080">Last 7 days</option>
              <option value="43200">Last 30 days</option>
              <option value="custom">Custom (UTC, up to 93 days)</option>
            </select>
          </label>
          {range === "custom" && (
            <>
              <label className="text-xs">
                Start (UTC)
                <Input
                  type="datetime-local"
                  step="0.001"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                />
              </label>
              <label className="text-xs">
                End (UTC)
                <Input
                  type="datetime-local"
                  step="0.001"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              disabled={range === "custom"}
              onClick={() => {
                if (live) setLive(false);
                else {
                  try {
                    parseLogQuery(draft);
                    apply({ query: draft, ...windowFor(Number(range)) });
                    setLive(true);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }
              }}
            >
              {live ? (
                <Pause className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {live ? "Pause live" : "Live refresh"}
            </Button>
            <Button onClick={run} disabled={query.isFetching}>
              <Play className="h-4 w-4" />
              Run query
            </Button>
          </div>
        </div>
        <textarea
          aria-label="Log query"
          spellCheck={false}
          className="block min-h-28 w-full resize-y bg-slate-500 p-5 font-mono text-sm leading-7 text-slate-900 outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder={"severity=ERROR\nsource=runtime"}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
          <span>
            Clauses use = and AND / new lines. message="text" searches event
            names. Ctrl/⌘ + Enter to run.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft("");
              setLive(false);
            }}
          >
            Clear query
          </Button>
        </div>
        <details className="px-4 pb-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            Supported fields and log coverage
          </summary>
          <p className="mt-2">
            severity, source, message, taskId, taskRunId, agentRunId,
            correlationId, traceId. Exact matches except message
            (case-insensitive substring). All clauses must match. Severity is
            inferred from event names. Runtime metadata and legacy execution
            steps are included; raw prompts, outputs, and legacy details are
            excluded.
          </p>
        </details>
      </section>

      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside
          className="rounded-xl border bg-card p-4 space-y-6"
          aria-label="Log fields"
        >
          <h2 className="text-sm font-semibold">Log fields</h2>
          <p className="text-xs text-muted-foreground">
            Counts match the applied query. Select a field, then run.
          </p>
          {(["severity", "source"] as const).map(field => (
            <div key={field}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {field}
              </h3>
              {(field === "severity"
                ? ["ERROR", "WARNING", "INFO"]
                : ["runtime", "execution"]
              ).map(value => (
                <button
                  key={value}
                  className="flex w-full justify-between rounded-md px-2 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => filter(field, value)}
                >
                  <span>{value}</span>
                  <span className="font-mono text-muted-foreground">
                    {data?.facets
                      .filter(f => f[field] === value)
                      .reduce((sum, f) => sum + f.count, 0) ?? 0}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </aside>
        <div className="min-w-0 space-y-4">
          <section
            className="rounded-xl border bg-card p-4"
            aria-label="Log timeline"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Timeline</h2>
              <span className="text-xs text-muted-foreground">
                {totalErrors} errors · Select a bar to zoom
              </span>
            </div>
            <div className="mt-4 flex h-24 items-end gap-1">
              {Array.from({ length: 40 }, (_, i) => {
                const bucket = data?.buckets.find(b => b.bucket === i);
                const start =
                  Date.parse(applied.start) +
                  ((Date.parse(applied.end) - Date.parse(applied.start)) * i) /
                    40;
                const end =
                  Date.parse(applied.start) +
                  ((Date.parse(applied.end) - Date.parse(applied.start)) *
                    (i + 1)) /
                    40;
                const label = `${formatTime(new Date(start).toISOString())}: ${bucket?.count ?? 0} entries, ${bucket?.errors ?? 0} errors`;
                return (
                  <button
                    key={i}
                    aria-label={label}
                    title={label}
                    className={`min-w-0 flex-1 rounded-t-sm transition-colors hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary ${bucket?.errors ? "bg-red-400" : bucket?.count ? "bg-blue-400" : "bg-muted"}`}
                    style={{
                      height: `${Math.max(3, ((bucket?.count ?? 0) / maxBucket) * 100)}%`,
                    }}
                    onClick={() => {
                      const time = {
                        start: new Date(start).toISOString(),
                        end: new Date(end).toISOString(),
                      };
                      setLive(false);
                      setRange("custom");
                      setCustomStart(time.start.slice(0, -1));
                      setCustomEnd(time.end.slice(0, -1));
                      apply({ query: applied.query, ...time });
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between gap-4 text-xs text-muted-foreground">
              <span>{formatTime(applied.start)}</span>
              <span>{formatTime(applied.end)}</span>
            </div>
          </section>

          <section
            className="overflow-hidden rounded-xl border bg-card"
            aria-label="Query results"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">
                  Query results{" "}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {data?.total ?? 0} entries
                  </span>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {live
                    ? "Refreshing every 10 seconds · Latest page"
                    : "Newest first · Timestamps shown in local time"}
                  {query.isFetching ? " · Loading…" : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!data?.entries.length || query.isFetching}
                onClick={download}
              >
                <Download className="h-4 w-4" />
                Export this page
              </Button>
            </div>
            {query.error ? (
              <div role="alert" className="p-6 text-sm text-destructive">
                Unable to load logs: {logErrorMessage(query.error)}
                <Button
                  variant="outline"
                  className="ml-3"
                  onClick={() => query.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : query.isPending ? (
              <div
                role="status"
                className="p-10 text-center text-muted-foreground"
              >
                Loading logs…
              </div>
            ) : !data?.entries.length ? (
              <div className="p-12 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <h3 className="font-medium">No matching logs</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try a wider time range or fewer filters. Executing tasks
                  creates new events.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[24px_80px_180px_1fr] gap-3 bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
                    <span />
                    <span>Severity</span>
                    <span>Timestamp</span>
                    <span>Event / resource</span>
                  </div>
                  {data.entries.map(entry => (
                    <div key={entry.id} className="border-t first:border-t-0">
                      <button
                        className="grid w-full grid-cols-[24px_80px_180px_1fr] items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        aria-expanded={expanded === entry.id}
                        onClick={() =>
                          setExpanded(expanded === entry.id ? null : entry.id)
                        }
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${expanded === entry.id ? "rotate-90" : ""}`}
                        />
                        <span
                          className={`rounded border px-2 py-1 text-[10px] font-bold ${colors[entry.severity]}`}
                        >
                          {entry.severity}
                        </span>
                        <time
                          className="font-mono text-xs"
                          dateTime={entry.timestamp}
                        >
                          {formatTime(entry.timestamp)}
                        </time>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-sm">
                            {entry.message}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entry.source} · Task #{entry.taskId}
                            {entry.taskRunId
                              ? ` · Run #${entry.taskRunId}`
                              : ""}
                          </span>
                        </span>
                      </button>
                      {expanded === entry.id && (
                        <div className="border-t bg-muted/20 p-4">
                          <div className="mb-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => related(entry)}
                            >
                              Show related events
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/tasks/${entry.taskId}`}>
                                Open task
                              </Link>
                            </Button>
                          </div>
                          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                            {JSON.stringify(entry, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>Page {page + 1} · Up to 100 entries per page</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0 || query.isFetching}
                  onClick={() => {
                    setLive(false);
                    setPage(page - 1);
                  }}
                >
                  Newer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data?.nextCursor || query.isFetching}
                  onClick={() => {
                    if (!data?.nextCursor) return;
                    setLive(false);
                    setHistory([...history.slice(0, page), data.nextCursor]);
                    setPage(page + 1);
                  }}
                >
                  Older
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
