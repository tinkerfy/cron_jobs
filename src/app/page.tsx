"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CronJob, formatDate, formatTime, buildDateTime } from "./lib/cron";
import { MatchedJob } from "./lib/cron";

const DEFAULT_RANGE_DAYS = 7;

export default function Home() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [results, setResults] = useState<MatchedJob[] | null>(null);
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
  const [filterApplied, setFilterApplied] = useState(false);
  const [showExecutionDates, setShowExecutionDates] = useState(true);

  const fromMinutes = parseInt(fromTime.split(':')[0]) * 60 + parseInt(fromTime.split(':')[1]);
  const toMinutes = parseInt(toTime.split(':')[0]) * 60 + parseInt(toTime.split(':')[1]);

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
      .then((data: CronJob[]) => setJobs(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load cron jobs:", err));
  }, []);

  const fetchResults = useCallback((from: Date, to: Date) => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    fetch(`/api/cron-jobs?from=${encodeURIComponent(fmt(from))}&to=${encodeURIComponent(fmt(to))}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch filtered jobs");
        return res.json();
      })
      .then((data: MatchedJob[]) => setResults(data.map(r => ({ ...r, matchedDates: r.matchedDates.map(d => new Date(d)) }))))
      .catch((err) => console.error("Failed to fetch filtered jobs:", err));
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultTo = new Date(today);
  defaultTo.setDate(defaultTo.getDate() + DEFAULT_RANGE_DAYS);

  const handleFilter = useCallback(() => {
    setFilterApplied(true);
    const from = buildDateTime(fromDate, fromTime);
    const to = buildDateTime(toDate, toTime);
    fetchResults(from, to);
  }, [fromDate, fromTime, toDate, toTime, fetchResults]);

  const handleReset = useCallback(() => {
    setFilterApplied(false);
    setResults(null);
  }, []);

  const matchingCount = results?.length ?? 0;
  const totalCount = results?.reduce((sum, r) => sum + r.totalCount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cron Job Scheduler</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            View which cron jobs fire within a selected date range
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Filter Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                From
              </label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="w-28 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                To
              </label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="w-28 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleFilter}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                Filter
              </button>
              {filterApplied && (
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Time Range Ruler */}
          <div className="mt-4">
            <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">Time Range</div>
            <div
              ref={rulerRef}
              className="relative h-8 rounded-lg overflow-hidden"
              style={{ background: "linear-gradient(to bottom, #334155, #1e293b)" }}
            >
              {/* Hour labels */}
              {Array.from({ length: 25 }, (_, i) => (
                <span
                  key={i}
                  className="absolute text-[9px] text-slate-400 dark:text-slate-500 pointer-events-none"
                  style={{ left: `${(i / 24) * 100}%`, transform: 'translateX(-50%)', top: 0 }}
                >
                  {String(i % 24).padStart(2, "0")}:00
                </span>
              ))}
              
              {/* Hour ticks */}
              {Array.from({ length: 25 }, (_, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none h-3 bg-slate-600/60"
                  style={{ left: `${(i / 24) * 100}%`, width: 1, top: 12 }}
                />
              ))}
              
              {/* Dimmed left */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  width: `${fromMinutes / 1440 * 100}%`,
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
                  width: `${(1440 - toMinutes) / 1440 * 100}%`,
                  top: 0,
                  height: '100%',
                  background: 'rgba(0,0,0,0.4)',
                }}
              />
              
              {/* Selected range fill */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${fromMinutes / 1440 * 100}%`,
                  width: `${(toMinutes - fromMinutes) / 1440 * 100}%`,
                  top: 0,
                  height: '100%',
                  background: 'rgba(59, 130, 246, 0.15)',
                }}
              />
              
              {/* Handle tracks */}
              <div
                className="absolute h-5 pointer-events-none"
                style={{ left: `${fromMinutes / 1440 * 100}%`, width: 20, top: 12, transform: 'translateX(-50%)' }}
              />
              <div
                className="absolute h-5 pointer-events-none"
                style={{ left: `${toMinutes / 1440 * 100}%`, width: 20, top: 12, transform: 'translateX(-50%)' }}
              />
              
              {/* Handles */}
              <div
                className="absolute w-4 h-6 cursor-ew-resize rounded-sm"
                style={{
                  left: `${fromMinutes / 1440 * 100}%`,
                  top: 12,
                  transform: 'translateX(-50%)',
                  background: 'rgba(59, 130, 246, 0.15)',
                }}
                onMouseDown={(e) => handleRulerMouseDown(e, 'from')}
              >
                <div
                  className="absolute w-1 h-5 bg-blue-400 rounded-full"
                  style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
                />
              </div>
              <div
                className="absolute w-4 h-6 cursor-ew-resize rounded-sm"
                style={{
                  left: `${toMinutes / 1440 * 100}%`,
                  top: 12,
                  transform: 'translateX(-50%)',
                  background: 'rgba(59, 130, 246, 0.15)',
                }}
                onMouseDown={(e) => handleRulerMouseDown(e, 'to')}
              >
                <div
                  className="absolute w-1 h-5 bg-blue-400 rounded-full"
                  style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
                />
              </div>
              
              {/* Subtle inner shadow */}
              <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)" }} />
            </div>
          </div>

          {/* Quick range buttons */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <span className="text-xs text-slate-400 dark:text-slate-500 self-center mr-2">Quick:</span>
            <div className="flex flex-wrap gap-2">
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
                    setFilterApplied(true);
                    fetchResults(quickFrom, quickTo);
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
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
                    setFilterApplied(true);
                    fetchResults(quickFrom, quickTo);
                  }}
                  className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {label}
                </button>
              );
            })}
            </div>
            <button
              onClick={() => setShowExecutionDates(!showExecutionDates)}
              className={`ml-auto text-xs px-3 py-1 rounded-full transition-colors ${
                showExecutionDates
                  ? "bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              {showExecutionDates ? "Hide Dates" : "Show Dates"}
            </button>
          </div>
        </div>

        {/* Results */}
        {results === null ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">⏰</div>
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Select a date range to filter jobs
            </h2>
            <p className="text-slate-400 dark:text-slate-500">
              Choose your dates above and click Filter to see which jobs will run
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {matchingCount > 0 ? (
                  <>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{matchingCount}</span> of{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{jobs.length}</span> jobs matched
                    {matchingCount > 0 && (
                      <span className="ml-2">
                        · <span className="font-semibold text-slate-700 dark:text-slate-200">{totalCount}</span> total executions
                      </span>
                    )}
                  </>
                ) : (
                  "No jobs matched the selected date range"
                )}
              </p>
            </div>

            {/* Job cards */}
            <div className="space-y-3">
              {results.map(({ job, matchedDates, totalCount }) => (
                <div
                  key={job.name}
                  className={`rounded-xl border shadow-sm transition-all ${
                    totalCount > 0
                      ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-800"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        totalCount > 0
                          ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                      }`}>
                        {totalCount > 0 ? (
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
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {job.name}
                          </h3>
                          <code className="text-sm bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-mono">
                            {job.schedule}
                          </code>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            totalCount > 0
                              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                          }`}>
                            {totalCount > 0 ? `${totalCount}x` : "No match"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {job.description}
                        </p>
                      </div>
                    </div>

                    {/* Matched dates */}
                    {totalCount > 0 && showExecutionDates && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                          Execution dates
                        </p>
                        {totalCount <= 500 ? (
                          <div className="flex flex-wrap gap-0.5">
                            {matchedDates.map((date, i) => (
                              <span
                                key={`${job.name}-${i}`}
                                className="inline-flex items-center text-[10px] px-1 py-0.5 bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded"
                              >
                                {formatDate(date)} {formatTime(date)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {matchedDates.slice(0, 50).map((date, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center text-[10px] px-1 py-0.5 bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded"
                                >
                                  {formatDate(date)} {formatTime(date)}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
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
