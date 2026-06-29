"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CronJob, MatchedJob, buildDateTime, expandCron } from "./lib/cron";
const SINGAPORE_TZ = "Asia/Singapore";
import ThemeToggle from "./theme-toggle";
import GibberishLoading from "./gibberish-loading";
import FilterPanel from "./components/FilterPanel";
import JobCard from "./components/JobCard";
import SortMenu from "./components/SortMenu";
import ExportButton from "./components/ExportButton";

export interface TimeRange {
  from: Date;
  to: Date;
}

export default function Home() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [results, setResults] = useState<MatchedJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [servers, setServers] = useState<string[]>([]);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSchedulers, setSelectedSchedulers] = useState<string[]>([]);
  const [searchService, setSearchService] = useState("");
  const [debouncedService, setDebouncedService] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "nextRun" | "count" | "server" | "service">("name");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedService(searchService);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchService]);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [fromTime, setFromTime] = useState("00:00");
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [toTime, setToTime] = useState("23:59");
  const [showExecutionDates, setShowExecutionDates] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [showAllMode, setShowAllMode] = useState(false);

  // Load jobs on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/cron-jobs")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load cron jobs");
        return res.json();
      })
      .then((data: CronJob[] | { jobs: CronJob[]; servers: string[] }) => {
        if (Array.isArray(data)) {
          setJobs(data);
          setServers([]);
        } else {
          setJobs(data.jobs);
          setServers(data.servers);
        }
      })
      .catch((err) => setError("Failed to load cron jobs: " + err.message))
      .finally(() => setLoading(false));
  }, []);

  const fetchResults = useCallback((showAll: boolean, from?: Date, to?: Date, service?: string) => {
    setLoading(true);

    if (showAll) {
      const params = new URLSearchParams({ showAll: "true" });
      const serviceVal = service !== undefined ? service : debouncedService;
      if (serviceVal) {
        params.set("compositeServiceName", serviceVal);
      }
      
      fetch(`/api/cron-jobs?${params.toString()}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch all jobs");
          return res.json();
        })
        .then((data: CronJob[]) => {
          let mapped: MatchedJob[];
          if (!showExecutionDates) {
            mapped = data.map((job) => ({ job, matchedDates: [], totalCount: 0 }));
          } else if (from && to) {
            const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
            if (rangeDays > 30) {
              mapped = data.map((job) => ({ job, matchedDates: [], totalCount: 0 }));
            } else {
              mapped = data.map((job) => {
                const dates = expandCron(job.schedule, from, to, SINGAPORE_TZ);
                return { job, matchedDates: dates, totalCount: dates.length };
              });
            }
          } else {
            mapped = data.map((job) => ({ job, matchedDates: [], totalCount: 0 }));
          }
          setResults(mapped);
        })
        .catch((err) => setError("Failed to fetch all jobs: " + err.message))
        .finally(() => setLoading(false));
      return;
    }

    if (!from || !to) {
      setLoading(false);
      return;
    }

    if (from > to) {
      console.error("Invalid date range: 'from' must be before 'to'");
      setLoading(false);
      return;
    }

    const maxRangeMs = 365 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      console.error("Date range too large. Maximum is 365 days.");
      setLoading(false);
      return;
    }

    const fmt = (d: Date) => {
      const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const offset = d.getTimezoneOffset();
      const sign = offset > 0 ? '-' : '+';
      const abs = Math.abs(offset);
      const oh = String(Math.floor(abs / 60)).padStart(2, '0');
      const om = String(abs % 60).padStart(2, '0');
      return `${base}${sign}${oh}:${om}`;
    };

    const params = new URLSearchParams({
      from: fmt(from),
      to: fmt(to),
    });

    if (selectedStatuses.length > 0) {
      params.set("status", selectedStatuses.join(","));
    }
    if (selectedSchedulers.length > 0) {
      params.set("scheduler", selectedSchedulers.join(","));
    }
    if (selectedServers.length > 0) {
      params.set("server", selectedServers.join(","));
    }
    const serviceToUse = service !== undefined ? service : debouncedService;
    if (serviceToUse) {
      params.set("compositeServiceName", serviceToUse);
    }

    fetch(`/api/cron-jobs?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch filtered jobs");
        return res.json();
      })
      .then((data: MatchedJob[]) => setResults(data.map(r => ({ ...r, matchedDates: r.matchedDates.map(d => new Date(d)) }))))
      .catch((err) => setError("Failed to fetch filtered jobs: " + err.message))
      .finally(() => setLoading(false));
  }, [selectedServers, selectedStatuses, selectedSchedulers, debouncedService, showExecutionDates]);

  useEffect(() => {
    if (showAllMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchResults(true);
    } else {
      const from = buildDateTime(fromDate, fromTime, SINGAPORE_TZ);
      const to = buildDateTime(toDate, toTime, SINGAPORE_TZ);
      fetchResults(false, from, to);
    }
  }, [fetchResults, showAllMode, fromDate, fromTime, toDate, toTime]);

  const matchingCount = results?.length ?? 0;
  const totalCount = results?.reduce((sum, r) => sum + r.totalCount, 0) ?? 0;

  const sortedResults = useMemo(() => {
    if (!results) return null;
    return [...results].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.job.compositeServiceName || "").localeCompare(b.job.compositeServiceName || "");
        case "nextRun":
          const aNext = a.matchedDates[0]?.getTime() ?? Infinity;
          const bNext = b.matchedDates[0]?.getTime() ?? Infinity;
          return aNext - bNext;
        case "count":
          return b.totalCount - a.totalCount;
        case "server":
          return (a.job.server || "").localeCompare(b.job.server || "");
        case "service":
          return (a.job.compositeServiceName || "").localeCompare(b.job.compositeServiceName || "");
        default:
          return 0;
      }
    });
  }, [results, sortBy]);

  const totalExportDates = results ? results.reduce((sum, r) => sum + r.totalCount, 0) : 0;

  const buildCsvData = (data: MatchedJob[]): string => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = [
      "Job", "Server", "Status", "Scheduler",
      "Minutes", "Hours", "Days", "Weeks", "Months", "Years",
    ].join(",");
    const rows = data.map(({ job }) => [
      escape(job.compositeServiceName || ""),
      escape(job.server || ""),
      job.status ? "true" : "false",
      escape(job.scheduler ?? ""),
      escape(job.minutes),
      escape(job.hours),
      escape(job.days),
      escape(job.weeks),
      escape(job.months),
      escape(job.years),
    ].join(","));
    return header + "\n" + rows.join("\n");
  };

  const handleExportCsv = () => {
    if (!results || results.length === 0) return;
    if (totalExportDates > 100000) {
      setExportWarning(`Exporting ${totalExportDates.toLocaleString()} dates. This may cause browser slowdown. Continue?`);
      return;
    }
    const csv = buildCsvData(results);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `cron-jobs-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportWarning(null);
  };

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const handleQuickRange = useCallback((range: TimeRange) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setFromDate(localDate(range.from));
    setToDate(localDate(range.to));
    setFromTime(`${pad(range.from.getHours())}:${pad(range.from.getMinutes())}`);
    setToTime(`${pad(range.to.getHours())}:${pad(range.to.getMinutes())}`);
    fetchResults(false, range.from, range.to);
  }, [fetchResults]);

  const handleShowAllMode = useCallback((showAll: boolean) => {
    setShowAllMode(showAll);
    if (showAll) {
      setSelectedServers([]);
      setSelectedStatuses([]);
      setSelectedSchedulers([]);
    } else {
      const pad = (n: number) => String(n).padStart(2, "0");
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      setFromDate(todayStr);
      setToDate(todayStr);
      setFromTime("00:00");
      setToTime("23:59");
    }
  }, [today]);

  return (
    <div className="min-h-screen bg-[#F5FAF7] dark:bg-slate-950">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <header className="bg-[#FFFFFF] dark:bg-slate-900 border-b border-[#D9ECD2] dark:border-slate-800 min-h-[72px]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#204D4C] dark:text-white tracking-tight">Cron Job Viewer</h1>
            <div className="overflow-hidden">
              <GibberishLoading active={loading} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#8BAFAD] dark:text-slate-400">
            <ThemeToggle />
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {jobs.length} jobs loaded
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <FilterPanel
          servers={servers}
          selectedServers={selectedServers}
          onSelectedServersChange={setSelectedServers}
          selectedStatuses={selectedStatuses}
          onSelectedStatusesChange={setSelectedStatuses}
          selectedSchedulers={selectedSchedulers}
          onSelectedSchedulersChange={setSelectedSchedulers}
          searchService={searchService}
          onSearchServiceChange={setSearchService}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          fromTime={fromTime}
          onFromTimeChange={setFromTime}
          toDate={toDate}
          onToDateChange={setToDate}
          toTime={toTime}
          onToTimeChange={setToTime}
          showAllMode={showAllMode}
          onApplyFilter={() => {
            const from = buildDateTime(fromDate, fromTime, SINGAPORE_TZ);
            const to = buildDateTime(toDate, toTime, SINGAPORE_TZ);
            fetchResults(false, from, to);
          }}
          onShowExecutionDates={setShowExecutionDates}
          showExecutionDates={showExecutionDates}
          onQuickRange={handleQuickRange}
          onShowAllMode={handleShowAllMode}
          today={today}
        />

        {/* Results */}
        {results === null ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-30">⏰</div>
            <h2 className="text-base font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Select a date range
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Choose your dates above and click Filter
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {matchingCount > 0 ? (
                  <>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{matchingCount}</span> jobs in range
                    · <span className="font-semibold text-slate-700 dark:text-slate-200">{totalCount}</span> executions
                  </>
                ) : (
                  "No jobs matched the selected date range"
                )}
              </p>
              <ExportButton
                results={results}
                exportWarning={exportWarning}
                onExport={handleExportCsv}
                onClearWarning={() => setExportWarning(null)}
              />
            </div>

            <div className="space-y-2">
              {sortedResults?.map(({ job, matchedDates, totalCount }, idx) => (
                <JobCard
                  key={`${job.compositeServiceName}-${idx}`}
                  job={job}
                  matchedDates={matchedDates}
                  totalCount={totalCount}
                  showExecutionDates={showExecutionDates}
                  idx={idx}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Showing {sortedResults?.length ?? 0} of {results.length} jobs
              </p>
              <SortMenu sortBy={sortBy} onSortChange={setSortBy} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
