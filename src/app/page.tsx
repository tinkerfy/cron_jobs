"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CronJob, formatDate, formatTime, buildDateTime } from "./lib/cron";
import { MatchedJob } from "./lib/cron";

export default function Home() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [results, setResults] = useState<MatchedJob[] | null>(null);
  const [servers, setServers] = useState<string[]>([]);
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchService, setSearchService] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split("T")[0];
  });
  const [fromTime, setFromTime] = useState("00:00");
  const [toDate, setToDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const defaultTo = new Date(today);
    defaultTo.setDate(defaultTo.getDate() + 7);
    return defaultTo.toISOString().split("T")[0];
  });
  const [toTime, setToTime] = useState("23:59");
  const [showExecutionDates, setShowExecutionDates] = useState(true);

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
      .catch((err) => console.error("Failed to load cron jobs:", err));
  }, []);

  const fetchResults = useCallback((from: Date, to: Date) => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const params = new URLSearchParams({
      from: fmt(from),
      to: fmt(to),
    });
    if (selectedStatuses.length > 0) {
      params.set("status", selectedStatuses.join(","));
    }
    if (selectedServers.length > 0) {
      params.set("server", selectedServers.join(","));
    }
    if (searchService) {
      params.set("compositeServiceName", searchService);
    }
    fetch(`/api/cron-jobs?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch filtered jobs");
        return res.json();
      })
      .then((data: MatchedJob[]) => setResults(data.map(r => ({ ...r, matchedDates: r.matchedDates.map(d => new Date(d)) }))))
      .catch((err) => console.error("Failed to fetch filtered jobs:", err));
  }, [selectedServers, selectedStatuses, searchService]);

  useEffect(() => {
    const from = buildDateTime(fromDate, fromTime);
    const to = buildDateTime(toDate, toTime);
    fetchResults(from, to);
  }, [fetchResults, fromDate, fromTime, toDate, toTime]);

  const matchingCount = results?.length ?? 0;
  const totalCount = results?.reduce((sum, r) => sum + r.totalCount, 0) ?? 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">Cron Job Viewer</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              View which cron jobs fire within a selected date range
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {jobs.length} jobs loaded
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Filter Panel */}
        <div className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
          {/* Panel header */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Date Range
              {selectedServers.length > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  ({selectedServers.length} server{selectedServers.length > 1 ? "s" : ""})
                </span>
              )}
              {selectedStatuses.length > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  ({selectedStatuses.length} status{selectedStatuses.length > 1 ? "s" : ""})
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{matchingCount > 0 ? `${matchingCount} of ${jobs.length} jobs` : "No filter applied"}</span>
          </div>

          {/* Date/time inputs */}
          <div className="px-4 py-3">
            <div className="flex items-start gap-4 mb-2">
              {/* Server filter */}
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Server
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedServers([])}
                    className={`h-7 px-2.5 text-[11px] font-medium rounded-full transition-colors ${
                      selectedServers.length === 0
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    All
                  </button>
                  {servers.map((server) => (
                    <button
                      key={server}
                      type="button"
                      onClick={() => {
                        setSelectedServers((prev) =>
                          prev.includes(server)
                            ? prev.filter((s) => s !== server)
                            : [...prev, server]
                        );
                      }}
                      className={`h-7 px-2.5 text-[11px] font-medium rounded-full transition-colors ${
                        selectedServers.includes(server)
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {server}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status filter */}
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Status
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedStatuses([])}
                    className={`h-7 px-2.5 text-[11px] font-medium rounded-full transition-colors ${
                      selectedStatuses.length === 0
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    All
                  </button>
                  {["true", "false"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        setSelectedStatuses((prev) =>
                          prev.includes(status)
                            ? prev.filter((s) => s !== status)
                            : [...prev, status]
                        );
                      }}
                      className={`h-7 px-2.5 text-[11px] font-medium rounded-full transition-colors ${
                        selectedStatuses.includes(status)
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {status === "true" ? "Enabled" : "Disabled"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service search */}
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Service
                </label>
                <input
                  type="text"
                  value={searchService}
                  onChange={(e) => setSearchService(e.target.value)}
                  placeholder="Search service..."
                  className="w-full h-7 px-2.5 text-[11px] border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-2 items-end">
              {/* From date */}
              <div className="col-span-1 md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
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
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
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
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
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
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              {/* Apply button */}
              <div className="col-span-1 md:col-span-2">
                <button
                  onClick={() => {
                    const from = buildDateTime(fromDate, fromTime);
                    const to = buildDateTime(toDate, toTime);
                    fetchResults(from, to);
                  }}
                  className="w-full h-7 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Filter
                </button>
              </div>
            </div>
          </div>

          {/* Time Range Ruler */}
          <div className="px-4 pb-3">
            <div
              ref={rulerRef}
              className="relative h-7 rounded overflow-hidden cursor-default"
              style={{ background: "linear-gradient(to bottom, #334155, #1e293b)" }}
            >
              {/* Hour labels */}
              {Array.from({ length: 25 }, (_, i) => (
                <span
                  key={i}
                  className="absolute text-[8px] text-slate-400 dark:text-slate-500 pointer-events-none"
                  style={{ left: `${(i / 24) * 100}%`, transform: 'translateX(-50%)', top: 2 }}
                >
                  {String(i % 24).padStart(2, "0")}:00
                </span>
              ))}
              
              {/* Hour ticks */}
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none h-1.5 bg-slate-600/60"
                  style={{ left: `${(i / 24) * 100}%`, width: 1, top: 12 }}
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
                  background: 'rgba(0,0,0,0.4)',
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
                  background: 'rgba(0,0,0,0.4)',
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
                  background: 'rgba(59, 130, 246, 0.15)',
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
                  background: 'rgba(59, 130, 246, 0.15)',
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
                  background: 'rgba(59, 130, 246, 0.15)',
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
              <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)" }} />
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
                  onClick={() => {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    setFromDate(localDate(quickFrom));
                    setToDate(localDate(quickTo));
                    setFromTime("00:00");
                    setToTime("23:59");
                    fetchResults(quickFrom, quickTo);
                  }}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  {label}
                </button>
              );
            })}
            {([
              [0, "Next 5 Min"],
              [-5, "Past 5 Min"],
            ] as [number, string][]).map(([offsetMin, label]) => {
              const now = new Date();
              const quickFrom = new Date(now);
              quickFrom.setMinutes(now.getMinutes() + offsetMin);
              quickFrom.setSeconds(0, 0);
              const quickTo = new Date(now);
              quickTo.setMinutes(now.getMinutes() + offsetMin + 5);
              quickTo.setSeconds(59, 999);
              return (
                <button
                  key={label}
                  onClick={() => {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    setFromDate(localDate(quickFrom));
                    setToDate(localDate(quickTo));
                    setFromTime(`${pad(quickFrom.getHours())}:${pad(quickFrom.getMinutes())}`);
                    setToTime(`${pad(quickTo.getHours())}:${pad(quickTo.getMinutes())}`);
                    fetchResults(quickFrom, quickTo);
                  }}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  {label}
                </button>
              );
            })}
            </div>
            <button
              onClick={() => setShowExecutionDates(!showExecutionDates)}
              className={`ml-auto text-[11px] px-3 py-1 rounded-full transition-colors ${
                showExecutionDates
                  ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
              }`}
            >
              {showExecutionDates ? "Hide Dates" : "Show Dates"}
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
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{matchingCount}</span> of{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{jobs.length}</span> jobs matched
                    {matchingCount > 0 && (
                      <span className="ml-1.5">
                        · <span className="font-semibold text-slate-700 dark:text-slate-200">{totalCount}</span> executions
                      </span>
                    )}
                  </>
                ) : (
                  "No jobs matched the selected date range"
                )}
              </p>
            </div>

            {/* Job cards */}
            <div className="space-y-2">
              {results.map(({ job, matchedDates, totalCount }, idx) => (
                <div
                  key={`${job.name}-${idx}`}
                  className={`rounded-lg border transition-colors ${
                    job.status === "false"
                      ? "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-50"
                      : totalCount > 0
                        ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800"
                        : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60"
                  }`}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        job.status === "true"
                          ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      }`}>
                        {job.status === "true" ? (
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
                                key={`${job.name}-${i}`}
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
