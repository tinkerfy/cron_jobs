export interface CronJob {
  schedule: string;
  description: string;
  server: string | null;
  compositeServiceName: string | null;
  status: boolean;
  scheduler: string | null;
}

export interface MatchedJob {
  job: CronJob;
  matchedDates: Date[];
  totalCount: number;
}

export interface CronJobRow {
  minutes: string;
  hours: string;
  days: string;
  months: string;
  weeks: string;
  years: string;
  server: string | null;
  compositeservicename: string | null;
  status: string;
  scheduler: string | null;
  description: string;
}
