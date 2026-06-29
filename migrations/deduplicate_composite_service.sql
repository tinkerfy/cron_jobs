-- Step 1: Delete duplicate rows (keep the one with the highest id per compositeservicename)
DELETE FROM cron_jobs
WHERE id NOT IN (
  SELECT keep_id FROM (
    SELECT MAX(id) AS keep_id
    FROM cron_jobs
    WHERE compositeservicename IS NOT NULL AND compositeservicename != ''
    GROUP BY compositeservicename
  ) AS tmp
);

-- Step 2: Add UNIQUE constraint
ALTER TABLE cron_jobs ADD UNIQUE INDEX uq_compositeservicename (compositeservicename);
