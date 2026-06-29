"use client";

import { MatchedJob, formatDate, formatTime } from "@/app/lib/cron";

interface JobCardProps {
  job: MatchedJob["job"];
  matchedDates: Date[];
  totalCount: number;
  showExecutionDates: boolean;
  idx: number;
}

export default function JobCard({ job, matchedDates, totalCount, showExecutionDates }: JobCardProps) {
  return (
    <div
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
  );
}
