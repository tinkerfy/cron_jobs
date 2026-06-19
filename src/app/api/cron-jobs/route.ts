import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/db";
import { cronMatches, MatchedJob } from "@/app/lib/cron";

interface CronJob {
  name: string;
  schedule: string;
  description: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    const result = await pool.query(
      `SELECT name, schedule, description
       FROM cron_jobs
       WHERE enabled = true
       ORDER BY name`
    );

    const jobs: CronJob[] = result.rows.map((row: { name: string; schedule: string; description: string }) => ({
      name: row.name,
      schedule: row.schedule,
      description: row.description,
    }));

    // If no date range provided, return raw jobs
    if (!fromDate || !toDate) {
      return NextResponse.json(jobs);
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
    }).filter((r: { totalCount: number }) => r.totalCount > 0);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to fetch cron jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron jobs" },
      { status: 500 }
    );
  }
}
