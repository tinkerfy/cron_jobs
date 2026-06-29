-- Add UNIQUE constraint to compositeservicename column
ALTER TABLE cron_jobs ADD UNIQUE INDEX uq_compositeservicename (compositeservicename);
