import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/db";
import { cronMatches, generateScheduleDescription } from "@/app/lib/cron";

interface CronJob {
  name: string;
  schedule: string;
  description: string;
  server: string | null;
  compositeServiceName: string | null;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const compositeServiceName = searchParams.get("compositeServiceName");
    const server = searchParams.get("server");
    const status = searchParams.get("status");

    const whereClauses: string[] = [];
    const params: (string | number)[] = [];

    if (compositeServiceName) {
      whereClauses.push("compositeservicename LIKE ?");
      params.push(`${compositeServiceName}%`);
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
      const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        whereClauses.push("status = ?");
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        const placeholders = statuses.map(() => "?").join(", ");
        whereClauses.push(`status IN (${placeholders})`);
        params.push(...statuses);
      }
    }
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [result] = await pool.query(
      `SELECT name, minutes, hours, days, months, weeks, years, server, compositeservicename, status, description
        FROM cron_jobs
        ${whereClause}
        ORDER BY name`,
      params
    ) as unknown as [{ name: string; minutes: string; hours: string; days: string; months: string; weeks: string; years: string; server: string | null; compositeservicename: string | null; status: string; description: string }[]];

    const jobs: CronJob[] = result.map((row) => ({
      name: row.name,
      schedule: `${row.minutes} ${row.hours} ${row.days} ${row.months} ${row.weeks} ${row.years || '*'}`,
      description: generateScheduleDescription(`${row.minutes} ${row.hours} ${row.days} ${row.months} ${row.weeks} ${row.years || '*'}`),
      server: row.server,
      compositeServiceName: row.compositeservicename,
      status: row.status,
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
