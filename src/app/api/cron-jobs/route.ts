import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/db";
import { cronMatches, generateScheduleDescription } from "@/app/lib/cron";
import { CronJob, CronJobRow } from "@/app/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const compositeServiceName = searchParams.get("compositeServiceName");
    const server = searchParams.get("server");
    const status = searchParams.get("status");
    const scheduler = searchParams.get("scheduler");

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (compositeServiceName) {
      whereClauses.push("compositeservicename LIKE ?");
      params.push(`%${compositeServiceName}%`);
    }
    if (server) {
      const servers = server.split(",").map(s => s.trim()).filter(Boolean);
      if (servers.length === 1) {
        whereClauses.push("server = ?");
        params.push(servers[0]);
      } else if (servers.length > 1) {
        const placeholders = servers.map(() => "?").join(", ");
        whereClauses.push(`server IN (${placeholders})`);
        params.push(...servers);
      }
    }
    if (status) {
      const statusValues = status.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (statusValues.length === 1) {
        whereClauses.push("status = ?");
        params.push(statusValues[0]);
      } else if (statusValues.length > 1) {
        const placeholders = statusValues.map(() => "?").join(", ");
        whereClauses.push(`status IN (${placeholders})`);
        params.push(...statusValues);
      }
    }
    if (scheduler) {
      const schedulers = scheduler.split(",").map(s => s.trim()).filter(Boolean);
      if (schedulers.length === 1) {
        whereClauses.push("scheduler = ?");
        params.push(schedulers[0]);
      } else if (schedulers.length > 1) {
        const placeholders = schedulers.map(() => "?").join(", ");
        whereClauses.push(`scheduler IN (${placeholders})`);
        params.push(...schedulers);
      }
    }
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [result] = await pool.query(
      `SELECT minutes, hours, days, months, weeks, years, server, compositeservicename, status, scheduler, description
        FROM cron_jobs
        ${whereClause}
        ORDER BY compositeservicename`,
      params
    ) as unknown as [CronJobRow[]];

    const jobs: CronJob[] = result.map((row) => ({
      schedule: `${row.minutes} ${row.hours} ${row.days} ${row.months} ${row.weeks} ${row.years || '*'}`,
      description: generateScheduleDescription(`${row.minutes} ${row.hours} ${row.days} ${row.months} ${row.weeks} ${row.years || '*'}`),
      server: row.server,
      compositeServiceName: row.compositeservicename,
      status: row.status === 'true',
      scheduler: row.scheduler,
    }));

    const servers = Array.from(new Set(result.map(r => r.server).filter(Boolean))) as string[];

    // If no date range provided, return raw jobs
    if (!fromDate || !toDate) {
      return NextResponse.json({ jobs, servers });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    // Server-side cron matching within the date range
    const results = jobs.map((job) => {
      const matchedDates: Date[] = [];
      const current = new Date(from);
      current.setSeconds(0, 0);

      const toClamped = new Date(to);
      toClamped.setSeconds(59, 999);

      while (current <= toClamped) {
        if (cronMatches(current, job.schedule)) {
          matchedDates.push(new Date(current));
        }
        current.setMinutes(current.getMinutes() + 1);
      }

      return {
        job,
        matchedDates: matchedDates.map(d => d.toISOString()),
        totalCount: matchedDates.length,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to fetch cron jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron jobs" },
      { status: 500 }
    );
  }
}
