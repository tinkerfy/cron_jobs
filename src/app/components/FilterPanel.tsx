"use client";

import TimeRuler from "./TimeRuler";

interface TimeRange {
  from: Date;
  to: Date;
}

interface FilterPanelProps {
  servers: string[];
  selectedServers: string[];
  onSelectedServersChange: (servers: string[]) => void;
  selectedStatuses: string[];
  onSelectedStatusesChange: (statuses: string[]) => void;
  selectedSchedulers: string[];
  onSelectedSchedulersChange: (schedulers: string[]) => void;
  searchService: string;
  onSearchServiceChange: (service: string) => void;
  fromDate: string;
  onFromDateChange: (date: string) => void;
  fromTime: string;
  onFromTimeChange: (time: string) => void;
  toDate: string;
  onToDateChange: (date: string) => void;
  toTime: string;
  onToTimeChange: (time: string) => void;
  showAllMode: boolean;
  onApplyFilter: () => void;
  onShowExecutionDates: (show: boolean) => void;
  showExecutionDates: boolean;
  onQuickRange: (range: TimeRange) => void;
  onShowAllMode: (showAll: boolean) => void;
  today: Date;
}

export default function FilterPanel({
  servers,
  selectedServers,
  onSelectedServersChange,
  selectedStatuses,
  onSelectedStatusesChange,
  selectedSchedulers,
  onSelectedSchedulersChange,
  searchService,
  onSearchServiceChange,
  fromDate,
  onFromDateChange,
  fromTime,
  onFromTimeChange,
  toDate,
  onToDateChange,
  toTime,
  onToTimeChange,
  showAllMode,
  onApplyFilter,
  onShowExecutionDates,
  showExecutionDates,
  onQuickRange,
  onShowAllMode,
  today,
}: FilterPanelProps) {
  return (
    <div className="bg-[#E8F0EA] dark:bg-slate-900 rounded-lg border border-[#D9ECD2] dark:border-slate-700 mb-6">
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
                onClick={() => onSelectedServersChange([])}
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
                    onSelectedServersChange(
                      selectedServers.includes(server)
                        ? selectedServers.filter((s) => s !== server)
                        : [...selectedServers, server]
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
                onClick={() => onSelectedStatusesChange([])}
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
                    onSelectedStatusesChange(
                      selectedStatuses.includes(val)
                        ? selectedStatuses.filter((s) => s !== val)
                        : [...selectedStatuses, val]
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
                onClick={() => onSelectedSchedulersChange([])}
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
                    onSelectedSchedulersChange(
                      selectedSchedulers.includes(val)
                        ? selectedSchedulers.filter((s) => s !== val)
                        : [...selectedSchedulers, val]
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
              onChange={(e) => onSearchServiceChange(e.target.value)}
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
              onChange={(e) => onFromDateChange(e.target.value)}
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
              onChange={(e) => onFromTimeChange(e.target.value)}
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
              onChange={(e) => onToDateChange(e.target.value)}
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
              onChange={(e) => onToTimeChange(e.target.value)}
              className="w-full h-8 px-2.5 text-xs border border-[#D9ECD2] dark:border-slate-700 rounded bg-[#F5FAF7] dark:bg-slate-800 text-[#204D4C] dark:text-white font-mono focus:ring-1 focus:ring-[#51A090] focus:border-[#51A090] outline-none transition-colors"
            />
          </div>

          {/* Apply button */}
          <div className="col-span-1 md:col-span-2">
            <button
              type="button"
              onClick={onApplyFilter}
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

      {/* Time Range Ruler */}
      <TimeRuler
        fromTime={fromTime}
        toTime={toTime}
        onFromTimeChange={onFromTimeChange}
        onToTimeChange={onToTimeChange}
        disabled={showAllMode}
      />

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
              onClick={() => onQuickRange({ from: quickFrom, to: quickTo })}
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
              onQuickRange({ from: quickFrom, to: quickTo });
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
              onQuickRange({ from: quickFrom, to: quickTo });
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
          onClick={() => onShowExecutionDates(!showExecutionDates)}
          className={`ml-auto text-[10px] px-2 py-0.5 rounded-full transition-colors ${
            showExecutionDates
              ? "bg-[#E4F2E7] dark:bg-[#1A3A38] text-[#51A090] dark:text-[#6AD4B8] hover:bg-[#D9ECD2] dark:hover:bg-[#2D4A48]"
              : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
          }`}
        >
          {showExecutionDates ? "Hide Dates" : "Show Dates"}
        </button>
        {/* Show All toggle button */}
        <button
          type="button"
          onClick={() => onShowAllMode(!showAllMode)}
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
      </div>
    </div>
  );
}
