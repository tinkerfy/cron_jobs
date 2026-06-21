import { NextResponse } from "next/server";
import pool from "@/app/lib/db";

export async function GET() {
  try {
    const [[compositeRows], [serverRows]] = await Promise.all([
      pool.query(`SELECT DISTINCT compositeservicename FROM cron_jobs WHERE compositeservicename IS NOT NULL ORDER BY compositeservicename`),
      pool.query(`SELECT DISTINCT server FROM cron_jobs WHERE server IS NOT NULL ORDER BY server`),
    ]);

    const compositeservicename = (compositeRows as { compositeservicename: string }[]).map((r) => r.compositeservicename);
    const servers = (serverRows as { server: string }[]).map((r) => r.server);

    return NextResponse.json({ compositeservicename, servers });
  } catch (error) {
    console.error("Failed to fetch filters:", error);
    return NextResponse.json({ error: "Failed to fetch filters" }, { status: 500 });
  }
}
