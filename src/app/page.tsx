"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CronJob, MatchedJob, formatDate, formatTime, buildDateTime, expandCron } from "./lib/cron";
import ThemeToggle from "./theme-toggle";
import GibberishLoading from "./gibberish-loading";

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
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedService(searchService);
    }, 2000);
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

  const fromMinutes = parseInt(fromTime.split(':')[0]) * 60 + parseInt(fromTime.split(':')[1]);
  const toMinutes = parseInt(toTime.split(':')[0]) * 60 + parseInt(toTime.split(':')[1]);

  const validFromMinutes = isNaN(fromMinutes) ? 0 : fromMinutes;
  const validToMinutes = isNaN(toMinutes) ? 1439 : toMinutes;

  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<'from' | 'to' | null>(null);

  const rulerRef = useRef<HTMLDivElement>(null);
  const fromTimeRef = useRef(fromTime);
  const toTimeRef = useRef(toTime);

  useEffect(() => { fromTimeRef.current = fromTime; });
  useEffect(() => { toTimeRef.current = toTime; });

  const handleRulerMouseDown = useCallback((e: React.MouseEvent, handle: 'from' | 'to') => {
    e.preventDefault();
    setIsDragging(true);
    setDragHandle(handle);
  }, []);

  useEffect(() => {
    if (!isDragging || !dragHandle || !rulerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = rulerRef.current!.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const minutes = Math.round(ratio * 1440);
      
      if (dragHandle === 'from') {
        const clamped = Math.min(minutes, parseInt(toTimeRef.current.split(':')[0]) * 60 + parseInt(toTimeRef.current.split(':')[1]) - 1);
        const h = String(Math.floor(clamped / 60)).padStart(2, '0');
        const m = String(clamped % 60).padStart(2, '0');
        setFromTime(`${h}:${m}`);
      } else {
        const clamped = Math.max(minutes, parseInt(fromTimeRef.current.split(':')[0]) * 60 + parseInt(fromTimeRef.current.split(':')[1]) + 1);
        const h = String(Math.floor(clamped / 60)).padStart(2, '0');
        const m = String(clamped % 60).padStart(2, '0');
        setToTime(`${h}:${m}`);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragHandle(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragHandle]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
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

    // Handle showAll mode - skip date validation and send different request
    if (showAll) {
      const params = new URLSearchParams({ showAll: "true" });
      if (service !== undefined ? service : debouncedService) {
        params.set("compositeServiceName", service !== undefined ? service : debouncedService);
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
          } else {
            const from = buildDateTime(fromDate, fromTime);
            const to = buildDateTime(toDate, toTime);
            const rangeDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
            if (rangeDays > 30) {
              mapped = data.map((job) => ({ job, matchedDates: [], totalCount: 0 }));
            } else {
              mapped = data.map((job) => {
                const dates = expandCron(job.schedule, from, to);
                return {
                  job,
                  matchedDates: dates,
                  totalCount: dates.length,
                };
              });
            }
          }
          setResults(mapped);
        })
        .catch((err) => setError("Failed to fetch all jobs: " + err.message))
        .finally(() => setLoading(false));
      return;
    }

    // Validate date range for normal mode
    if (from && to && from > to) {
      console.error("Invalid date range: 'from' must be before 'to'");
      setLoading(false);
      return;
    }
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 365 days
    if (to.getTime() - from.getTime() > maxRangeMs) {
      console.error("Date range too large. Maximum is 365 days.");
      setLoading(false);
      return;
    }

    // Format date with timezone offset so server parses it as local time (not UTC)
    const fmt = (d: Date) => {
      const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const offset = d.getTimezoneOffset(); // minutes west of UTC (negative when ahead)
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
      // In showAll mode, just call with true and no dates
      fetchResults(true);
    } else {
      const from = buildDateTime(fromDate, fromTime);
      const to = buildDateTime(toDate, toTime);
      fetchResults(false, from, to);
    }
  }, [fetchResults, showAllMode, fromDate, fromTime, toDate, toTime]);

  const matchingCount = results?.length ?? 0;
  const totalCount = results?.reduce((sum, r) => sum + r.totalCount, 0) ?? 0;

  const sortedResults = results ? [...results].sort((a, b) => {
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
  }) : null;

  const sortLabels: Record<string, string> = {
    name: "Name",
    nextRun: "Next Run",
    count: "Execution Count",
    server: "Server",
    service: "Service",
  };

  // --- CSV Export ---
  const totalExportDates = results ? results.reduce((sum, r) => sum + r.totalCount, 0) : 0;

  const buildCsvData = (data: MatchedJob[]): string => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = [
      "Job",
      "Server",
      "Status",
      "Scheduler",
      "Minutes",
      "Hours",
      "Days",
      "Weeks",
      "Months",
      "Years",
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
      {/* Header */}
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
        {/* Filter Panel */}
        <div className="bg-[#E8F0EA] dark:bg-slate-900 rounded-lg border border-[#D9ECD2] dark:border-slate-700 mb-6">
          {/* Panel header */}
          {/* <div className="px-4 py-2.5 border-b border-[#D9ECD2] dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#204D4C] dark:text-slate-300 uppercase tracking-wider">
              Date Range
              {selectedServers.length > 0 && (
                <span className="ml-2 text-[#51A090] dark:text-blue-400">
                  ({selectedServers.length} server{selectedServers.length > 1 ? "s" : ""})
                </span>
              )}
              {selectedStatuses.length > 0 && (
                <span className="ml-2 text-[#51A090] dark:text-blue-400">
                  ({selectedStatuses.length} status{selectedStatuses.length > 1 ? "s" : ""})
                </span>
              )}
              {selectedSchedulers.length > 0 && (
                <span className="ml-2 text-[#51A090] dark:text-blue-400">
                  ({selectedSchedulers.length} scheduler{selectedSchedulers.length > 1 ? "s" : ""})
                </span>
              )}
            </span>
            <span className="text-[11px] text-[#8BAFAD] dark:text-slate-500">{matchingCount > 0 ? `${matchingCount} of ${jobs.length} jobs` : "No filter applied"}</span>
          </div> */}

          {/* Date/time inputs */}
          <div className="px-4 py-3 border-t border-[#D9ECD2] dark:border-slate-800">
            <div className="flex items-start gap-4 mb-2">
              {/* Server filter */}
              <div className={`flex-1 min-w-0 ${showAllMode ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="block text-[11px] font-semibold text-[#204D4C] dark:text-slate-400 uppercase tracking-wider mb-1">
                  Server
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={showAllMode}
                    onClick={() => setSelectedServers([])}
                    className={`h-6 px-2.5 text-[10px] font-medium rounded-full transition-all border text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none ${
                      showAllMode ? 'cursor-not-allowed' : ''
                    } ${
                      selectedServers.length === 0
                        ? "bg-[#4A9380] text-white border-[#4A9380] ring-2 ring-[#4A9380] ring-offset-1"
                        : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                    }`}
                  >
                    All
                  </button>
                  {[...servers].sort().map((server) => (
                    <button
                      key={server}
                      type="button"
                      disabled={showAllMode}
                      onClick={() => {
                        setSelectedServers((prev) =>
                          prev.includes(server)
                            ? prev.filter((s) => s !== server)
                            : [...prev, server]
                        );
                      }}
                      className={`h-6 px-2 text-[10px] font-medium rounded-full transition-all border text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none ${
                        showAllMode ? 'cursor-not-allowed' : ''
                      } ${
                        selectedServers.includes(server)
                          ? "bg-[#4A9380] text-white border-[#4A9380] ring-2 ring-[#4A9380] ring-offset-1"
                          : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                      }`}
                    >
                      {server}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status filter */}
              <div className={`flex-1 min-w-0 ${showAllMode ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="block text-[11px] font-semibold text-[#204D4C] dark:text-slate-400 uppercase tracking-wider mb-1">
                  STATUS
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={showAllMode}
                    onClick={() => setSelectedStatuses([])}
                    className={`h-6 px-2.5 text-[10px] font-medium rounded-full transition-all border text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none ${
                      showAllMode ? 'cursor-not-allowed' : ''
                    } ${
                      selectedStatuses.length === 0
                        ? "bg-[#4A9380] text-white border-[#4A9380] ring-2 ring-[#4A9380] ring-offset-1"
                        : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                    }`}
                  >
                    All
                  </button>
                  {["true", "false"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={showAllMode}
                      onClick={() => {
                        setSelectedStatuses((prev) =>
                          prev.includes(val)
                            ? prev.filter((s) => s !== val)
                            : [...prev, val]
                        );
                      }}
                      className={`h-6 px-2 text-[10px] font-medium rounded-full transition-all border text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none ${
                        showAllMode ? 'cursor-not-allowed' : ''
                      } ${
                        selectedStatuses.includes(val)
                          ? "bg-[#4A9380] text-white border-[#4A9380] ring-2 ring-[#4A9380] ring-offset-1"
                          : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                      }`}
                    >
                      {val === "true" ? "Enabled" : "Disabled"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scheduler filter */}
              <div className={`flex-1 min-w-0 ${showAllMode ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className="block text-[11px] font-semibold text-[#204D4C] dark:text-slate-400 uppercase tracking-wider mb-1">
                  Scheduler
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={showAllMode}
                    onClick={() => setSelectedSchedulers([])}
                    className={`h-6 px-2.5 text-[10px] font-medium rounded-full transition-all border text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none ${
                      showAllMode ? 'cursor-not-allowed' : ''
                    } ${
                      selectedSchedulers.length === 0
                        ? "bg-[#4A9380] text-white border-[#4A9380] ring-2 ring-[#4A9380] ring-offset-1"
                        : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                    }`}
                  >
                    All
                  </button>
                  {["true", "false"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={showAllMode}
                      onClick={() => {
                        setSelectedSchedulers((prev) =>
                          prev.includes(val)
                            ? prev.filter((s) => s !== val)
                            : [...prev, val]
                        );
                      }}
                      className={`h-6 px-2 text-[10px] font-medium rounded-full transition-all border text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none ${
                        showAllMode ? 'cursor-not-allowed' : ''
                      } ${
                        selectedSchedulers.includes(val)
                          ? "bg-[#4A9380] text-white border-[#4A9380] ring-2 ring-[#4A9380] ring-offset-1"
                          : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                      }`}
                    >
                      {val === "true" ? "Active" : "Inactive"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service search - ALWAYS ENABLED */}
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-[#204D4C] dark:text-slate-400 uppercase tracking-wider mb-1">
                  Service
                </label>
                <input
                  type="text"
                  value={searchService}
                  onChange={(e) => setSearchService(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (debounceRef.current) clearTimeout(debounceRef.current);
                      setDebouncedService(searchService);
                    }
                  }}
                  placeholder="Search service..."
                  className="w-full h-7 px-2.5 text-[11px] border border-[#D9ECD2] dark:border-slate-700 rounded bg-[#F5FAF7] dark:bg-slate-800 text-[#204D4C] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-[#51A090] focus:border-[#51A090] outline-none transition-colors"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="my-3">
              <div className="h-px bg-gradient-to-r from-transparent via-[#A3C4A0] to-transparent dark:via-slate-700" />
            </div>

            {/* Date/time inputs - disabled in showAll mode */}
            <div className={`grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-2 items-end ${showAllMode ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* From date */}
              <div className="col-span-1 md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-[#D9ECD2] dark:border-slate-700 rounded bg-[#F5FAF7] dark:bg-slate-800 text-[#204D4C] dark:text-white focus:ring-1 focus:ring-[#51A090] focus:border-[#51A090] outline-none transition-colors"
                />
              </div>

              {/* From time */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-[#D9ECD2] dark:border-slate-700 rounded bg-[#F5FAF7] dark:bg-slate-800 text-[#204D4C] dark:text-white font-mono focus:ring-1 focus:ring-[#51A090] focus:border-[#51A090] outline-none transition-colors"
                />
              </div>

              {/* To date */}
              <div className="col-span-1 md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-[#D9ECD2] dark:border-slate-700 rounded bg-[#F5FAF7] dark:bg-slate-800 text-[#204D4C] dark:text-white focus:ring-1 focus:ring-[#51A090] focus:border-[#51A090] outline-none transition-colors"
                />
              </div>

              {/* To time */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-[#D9ECD2] dark:border-slate-700 rounded bg-[#F5FAF7] dark:bg-slate-800 text-[#204D4C] dark:text-white font-mono focus:ring-1 focus:ring-[#51A090] focus:border-[#51A090] outline-none transition-colors"
                />
              </div>

              {/* Apply button */}
              <div className="col-span-1 md:col-span-2">
                <button
                  type="button"
                  onClick={() => {
                    const from = buildDateTime(fromDate, fromTime);
                    const to = buildDateTime(toDate, toTime);
                    fetchResults(from, to);
                  }}
                  className="w-full h-8 px-3 bg-[#51A090] hover:bg-[#468F80] active:bg-[#3D8070] text-white text-xs font-medium rounded border border-[#51A090] transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Filter
                </button>
              </div>
            </div>
          </div>

          {/* Time Range Ruler - disabled in showAll mode */}
          <div className={`px-4 pb-3 ${showAllMode ? 'opacity-50 pointer-events-none' : ''}`}>
            <div
              ref={rulerRef}
              className="relative h-7 rounded overflow-hidden cursor-default"
              style={{ background: "linear-gradient(to bottom, #DCE8D8, #C8DEC8)" }}
            >
              {/* Hour labels */}
              {Array.from({ length: 25 }, (_, i) => (
                <span
                  key={i}
                  className="absolute text-[8px] pointer-events-none text-[#204D4C]"
                  style={{ left: `${(i / 24) * 100}%`, transform: 'translateX(-50%)', top: 2 }}
                >
                  {String(i % 24).padStart(2, "0")}:00
                </span>
              ))}
              
              {/* Hour ticks */}
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                className="absolute pointer-events-none h-1.5"
                style={{ left: `${(i / 24) * 100}%`, width: 1, top: 12, backgroundColor: 'rgba(32, 77, 76, 0.2)' }}
                />
              ))}
              
              {/* Dimmed left */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  width: `${validFromMinutes / 1440 * 100}%`,
                  top: 0,
                  height: '100%',
                  background: 'rgba(32, 77, 76, 0.5)',
                }}
              />
              
              {/* Dimmed right */}
              <div
                className="absolute pointer-events-none"
                style={{
                  right: 0,
                  width: `${(1440 - validToMinutes) / 1440 * 100}%`,
                  top: 0,
                  height: '100%',
                  background: 'rgba(32, 77, 76, 0.5)',
                }}
              />
              
              {/* Selected range fill */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${validFromMinutes / 1440 * 100}%`,
                  width: `${(validToMinutes - validFromMinutes) / 1440 * 100}%`,
                  top: 0,
                  height: '100%',
                  background: 'rgba(81, 160, 144, 0.15)',
                }}
              />
              
              {/* Handle tracks */}
              <div
                className="absolute h-4 pointer-events-none"
                style={{ left: `${validFromMinutes / 1440 * 100}%`, width: 16, top: 10, transform: 'translateX(-50%)' }}
              />
              <div
                className="absolute h-4 pointer-events-none"
                style={{ left: `${validToMinutes / 1440 * 100}%`, width: 16, top: 10, transform: 'translateX(-50%)' }}
              />
              
              {/* Handles */}
              <div
                className="absolute w-3 h-5 cursor-ew-resize rounded-sm"
                style={{
                  left: `${validFromMinutes / 1440 * 100}%`,
                  top: 10,
                  transform: 'translateX(-50%)',
                  background: '#51A090',
                }}
                onMouseDown={(e) => handleRulerMouseDown(e, 'from')}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 60 : 5;
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const newMinutes = Math.max(0, validFromMinutes - step);
                    const h = String(Math.floor(newMinutes / 60)).padStart(2, '0');
                    const m = String(newMinutes % 60).padStart(2, '0');
                    setFromTime(`${h}:${m}`);
                  }
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const newMinutes = Math.min(1439, validFromMinutes + step);
                    const h = String(Math.floor(newMinutes / 60)).padStart(2, '0');
                    const m = String(newMinutes % 60).padStart(2, '0');
                    setFromTime(`${h}:${m}`);
                  }
                }}
                tabIndex={0}
                role="slider"
                aria-label="From time"
                aria-valuemin={0}
                aria-valuemax={1439}
                aria-valuenow={validFromMinutes}
              >
                <div
                  className="absolute w-1 h-4 bg-blue-400 rounded-full"
                  style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
                />
              </div>
              <div
                className="absolute w-3 h-5 cursor-ew-resize rounded-sm"
                style={{
                  left: `${validToMinutes / 1440 * 100}%`,
                  top: 10,
                  transform: 'translateX(-50%)',
                  background: '#51A090',
                }}
                onMouseDown={(e) => handleRulerMouseDown(e, 'to')}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 60 : 5;
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const newMinutes = Math.max(0, validToMinutes - step);
                    const h = String(Math.floor(newMinutes / 60)).padStart(2, '0');
                    const m = String(newMinutes % 60).padStart(2, '0');
                    setToTime(`${h}:${m}`);
                  }
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const newMinutes = Math.min(1439, validToMinutes + step);
                    const h = String(Math.floor(newMinutes / 60)).padStart(2, '0');
                    const m = String(newMinutes % 60).padStart(2, '0');
                    setToTime(`${h}:${m}`);
                  }
                }}
                tabIndex={0}
                role="slider"
                aria-label="To time"
                aria-valuemin={0}
                aria-valuemax={1439}
                aria-valuenow={validToMinutes}
              >
                <div
                  className="absolute w-1 h-4 bg-blue-400 rounded-full"
                  style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
                />
              </div>
              
              {/* Subtle inner shadow */}
              <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)" }} />
            </div>
          </div>

          {/* Quick range buttons */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-0.5">Quick:</span>
            <div className="flex flex-wrap gap-1">
            {([
              [0, "Today"],
              [1, "1 Day"],
            ] as [number, string][]).map(([days, label]) => {
              const quickFrom = new Date(today);
              quickFrom.setHours(0, 0, 0, 0);
              const quickTo = new Date(today);
              quickTo.setDate(quickTo.getDate() + days);
              quickTo.setHours(23, 59, 59, 999);
              return (
                <button
                  key={`${days}-${label}`}
                  type="button"
                  disabled={showAllMode}
                  aria-label={`Set date range to ${label}`}
                  onClick={() => {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    setFromDate(localDate(quickFrom));
                    setToDate(localDate(quickTo));
                    setFromTime("00:00");
                    setToTime("23:59");
                    fetchResults(quickFrom, quickTo);
                  }}
                  className="h-6 px-2 text-[10px] font-medium rounded-full transition-colors bg-slate-100 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 dark:active:bg-slate-400 text-slate-700 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none"
                >
                  {label}
                </button>
              );
            })}
            {([
              [0, 5, "Next 5 Min"],
              [-5, 5, "Past 5 Min"],
            ] as [number, number, string][]).map(([offsetMin, duration, label]) => (
              <button
                key={`${offsetMin}-${label}`}
                type="button"
                disabled={showAllMode}
                aria-label={`Set date range to ${label}`}
                onClick={() => {
                  const now = new Date();
                  const quickFrom = new Date(now);
                  quickFrom.setMinutes(now.getMinutes() + offsetMin);
                  quickFrom.setSeconds(0, 0);
                  const quickTo = new Date(now);
                  quickTo.setMinutes(now.getMinutes() + offsetMin + duration);
                  quickTo.setSeconds(59, 999);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  setFromDate(`${quickFrom.getFullYear()}-${pad(quickFrom.getMonth() + 1)}-${pad(quickFrom.getDate())}`);
                  setToDate(`${quickTo.getFullYear()}-${pad(quickTo.getMonth() + 1)}-${pad(quickTo.getDate())}`);
                  setFromTime(`${pad(quickFrom.getHours())}:${pad(quickFrom.getMinutes())}`);
                  setToTime(`${pad(quickTo.getHours())}:${pad(quickTo.getMinutes())}`);
                  fetchResults(quickFrom, quickTo);
                }}
                className="h-6 px-2 text-[10px] font-medium rounded-full transition-colors bg-slate-100 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none"
              >
                {label}
              </button>
            ))}
            {([
              [0, 30, "Next 30 Min"],
              [-30, 30, "Past 30 Min"],
              [0, 60, "Next 1 Hour"],
              [-60, 60, "Past 1 Hour"],
            ] as [number, number, string][]).map(([offsetMin, duration, label]) => (
              <button
                key={`${offsetMin}-${label}`}
                type="button"
                disabled={showAllMode}
                aria-label={`Set date range to ${label}`}
                onClick={() => {
                  const now = new Date();
                  const quickFrom = new Date(now);
                  quickFrom.setMinutes(now.getMinutes() + offsetMin);
                  quickFrom.setSeconds(0, 0);
                  const quickTo = new Date(now);
                  quickTo.setMinutes(now.getMinutes() + offsetMin + duration);
                  quickTo.setSeconds(59, 999);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  setFromDate(`${quickFrom.getFullYear()}-${pad(quickFrom.getMonth() + 1)}-${pad(quickFrom.getDate())}`);
                  setToDate(`${quickTo.getFullYear()}-${pad(quickTo.getMonth() + 1)}-${pad(quickTo.getDate())}`);
                  setFromTime(`${pad(quickFrom.getHours())}:${pad(quickFrom.getMinutes())}`);
                  setToTime(`${pad(quickTo.getHours())}:${pad(quickTo.getMinutes())}`);
                  fetchResults(quickFrom, quickTo);
                }}
                className="h-6 px-2 text-[10px] font-medium rounded-full transition-colors bg-slate-100 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-white focus-visible:ring-2 focus-visible:ring-[#51A090] focus-visible:ring-offset-1 focus-visible:outline-none"
              >
                {label}
              </button>
            ))}
            </div>
            <button
              type="button"
              aria-pressed={showExecutionDates}
              onClick={() => setShowExecutionDates(!showExecutionDates)}
              className={`ml-auto text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                showExecutionDates
                  ? "bg-[#E4F2E7] dark:bg-[#1A3A38] text-[#51A090] dark:text-[#6AD4B8] hover:bg-[#D9ECD2] dark:hover:bg-[#2D4A48]"
                  : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
              }`}
            >
              {showExecutionDates ? "Hide Dates" : "Show Dates"}
            </button>
            <div className="relative" ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`ml-2 text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                  sortBy !== "name"
                    ? "bg-[#E4F2E7] dark:bg-[#1A3A38] text-[#51A090] dark:text-[#6AD4B8] hover:bg-[#D9ECD2] dark:hover:bg-[#2D4A48]"
                    : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                }`}
              >
                Sort
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
                  {Object.entries(sortLabels).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setSortBy(key as typeof sortBy); setShowSortMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between transition-colors ${
                        sortBy === key
                          ? "bg-[#E4F2E7] dark:bg-[#1A3A38] text-[#51A090] dark:text-[#6AD4B8]"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {label}
                      {sortBy === key && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Show All toggle button */}
            <button
              type="button"
              onClick={() => {
                setShowAllMode(!showAllMode);
                if (!showAllMode) {
                  // Clear other filters when entering showAll mode
                  setSelectedServers([]);
                  setSelectedStatuses([]);
                  setSelectedSchedulers([]);
                } else {
                  // Reset date/time when exiting showAll mode
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
                  setFromDate(todayStr);
                  setToDate(todayStr);
                  setFromTime("00:00");
                  setToTime("23:59");
                }
              }}
              className={`ml-2 text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                showAllMode
                  ? "bg-[#4A9380] dark:bg-[#3D8070] text-white hover:bg-[#3D8070] dark:hover:bg-[#2D6E5E]"
                  : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
              }`}
              title={showAllMode ? "Show only matched jobs in date range" : "Show all jobs regardless of date range"}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {showAllMode ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.528 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.07 7-9.542 7S2.458 16.057 1.184 12zM12 1v2m0 16v2M4.22 4.22l1.42 1.42m10.14 10.14l1.42-1.42M4.22 19.78l1.42-1.42M18.36 5.64l1.42 1.42" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.238 1.706c1.724 0 3.35 0 3.35 0M17.97 9.07a2.75 2.75 0 01-4.7 0 2.75 2.75 0 01-4.7 0m.86-6.83c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.238-1.706c-1.724 0-3.35 0-3.35 0M6.03 9.07a2.75 2.75 0 014.7 0 2.75 2.75 0 014.7 0m-.86 6.83c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.238 1.706c1.724 0 3.35 0 3.35 0" />
                )}
              </svg>
              {showAllMode ? "Hide All" : "Show All"}
            </button>
            
            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!results || results.length === 0}
              className={`ml-2 text-[10px] px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                results && results.length > 0
                  ? "bg-[#E4F2E7] dark:bg-[#1A3A38] text-[#51A090] dark:text-[#6AD4B8] hover:bg-[#D9ECD2] dark:hover:bg-[#2D4A48] cursor-pointer"
                  : "bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
              }`}
              title={results && results.length > 0 ? "Export matched jobs to CSV" : "No results to export"}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

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
            {/* Summary */}
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
              {exportWarning && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {exportWarning}
                </p>
              )}
            </div>

            {/* Job cards */}
            <div className="space-y-2">
              {sortedResults?.map(({ job, matchedDates, totalCount }, idx) => (
                <div
                  key={`${job.compositeServiceName}-${idx}`}
                  className={`rounded-lg border transition-colors ${
                    job.status === false
                      ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-50"
                      : "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        job.status === true
                          ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      }`}>
                        {job.status ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {job.compositeServiceName || 'NULL'}
                          </span>
                          <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono">
                            {job.schedule}
                          </code>
                          {job.server && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              job.server === "Prod1" ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300"
                              : job.server === "Prod2" ? "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300"
                              : "bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300"
                            }`}>
                              {job.server}
                            </span>
                          )}
                          {job.scheduler !== null && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              job.scheduler === 'true'
                                ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            }`}>
                              {job.scheduler === 'true' ? "Scheduler: Active" : "Scheduler: Inactive"}
                            </span>
                          )}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            totalCount > 0
                              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          }`}>
                            {totalCount > 0 ? `${totalCount}x` : "No match"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {job.description}
                        </p>
              </div>
            </div>

                    {/* Matched dates */}
                    {totalCount > 0 && showExecutionDates && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                          Execution dates
                        </p>
                        {totalCount <= 500 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {matchedDates.map((date, i) => (
                              <span
                                key={`${job.compositeServiceName}-${i}`}
                                className="inline-flex items-center text-[10px] px-1 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded"
                              >
                                {formatDate(date)} {formatTime(date)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {matchedDates.slice(0, 50).map((date, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center text-[10px] px-1 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded"
                                >
                                  {formatDate(date)} {formatTime(date)}
                                </span>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              + {totalCount - 50} more executions
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
