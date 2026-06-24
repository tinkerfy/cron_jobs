import { NextResponse } from "next/server";
import pool from "@/app/lib/db";

export async function GET() {
  try {
    const [[compositeRows], [serverRows], [statusRows]] = await Promise.all([
      pool.query(`SELECT DISTINCT compositeservicename FROM cron_jobs WHERE compositeservicename IS NOT NULL ORDER BY compositeservicename`),
      pool.query(`SELECT DISTINCT server FROM cron_jobs WHERE server IS NOT NULL ORDER BY server`),
      pool.query(`SELECT DISTINCT status FROM cron_jobs WHERE status IS NOT NULL ORDER BY status`),
    ]);

    const compositeservicename = (compositeRows as { compositeservicename: string }[]).map((r) => r.compositeservicename);
    const servers = (serverRows as { server: string }[]).map((r) => r.server);
    const statuses = (statusRows as { status: string }[]).map((r) => r.status);

    return NextResponse.json({ compositeservicename, servers, statuses });
  } catch (error) {
    console.error("Failed to fetch filters:", error);
    return NextResponse.json({ error: "Failed to fetch filters" }, { status: 500 });
  }
}
