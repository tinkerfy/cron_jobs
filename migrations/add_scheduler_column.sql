-- Add scheduler column to cron_jobs table
ALTER TABLE cron_jobs ADD COLUMN scheduler BOOLEAN DEFAULT NULL AFTER status;

-- Populate existing rows: true if status = 'true', false otherwise
UPDATE cron_jobs SET scheduler = (status = 'true') WHERE scheduler IS NULL;
