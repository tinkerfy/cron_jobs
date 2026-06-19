#!/bin/bash
# agent.sh - PostgreSQL setup agent for cronjobs project
# This script:
#   1. Checks/installs PostgreSQL
#   2. Creates the 'cronjobs' database
#   3. Creates the 'cron_jobs' table
#   4. Populates it with random cron jobs
#   5. Syncs cron_jobs.json

set -e

echo "=== Cronjobs PostgreSQL Agent ==="
echo ""

# ─── 1. Check if PostgreSQL is installed ───────────────────────────────
if command -v psql &>/dev/null; then
  echo "✓ PostgreSQL found: $(psql --version)"
else
  echo "✗ PostgreSQL not found. Installing..."
  
  if command -v brew &>/dev/null; then
    brew install postgresql
    brew services start postgresql
  elif command -v apt-get &>/dev/null; then
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo service postgresql start
  elif command -v yum &>/dev/null; then
    sudo yum install -y postgresql-server
    sudo postgresql-setup --initdb
    sudo systemctl start postgresql
  elif command -v docker &>/dev/null; then
    echo "Installing via Docker..."
    docker run -d --name postgres-cronjobs -e POSTGRES_DB=cronjobs -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
    export PGPASSWORD=postgres
    export PGHOST=localhost
    export PGUSER=postgres
    export PGDATABASE=cronjobs
    echo "Waiting for PostgreSQL to start..."
    for i in $(seq 1 30); do
      if docker exec postgres-cronjobs pg_isready &>/dev/null; then
        break
      fi
      sleep 1
    done
    PSQL_CMD="docker exec -i postgres-cronjobs psql -U postgres"
    DB_PASS="postgres"
    echo "✓ PostgreSQL running in Docker"
  else
    echo "ERROR: Cannot install PostgreSQL automatically."
    echo "Options:"
    echo "  1. Install via: https://www.postgresql.org/download/"
    echo "  2. Use Docker: docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16"
    echo "  Then re-run this script."
    exit 1
  fi
  echo "✓ PostgreSQL installed and started"
fi

# ─── 2. Ensure PostgreSQL is running ──────────────────────────────────
if ! pg_isready &>/dev/null; then
  echo "Starting PostgreSQL..."
  
  if command -v brew &>/dev/null; then
    brew services start postgresql
  elif command -v pg_ctlcluster &>/dev/null; then
    sudo pg_ctlcluster 16 main start
  elif command -v pg_ctl &>/dev/null; then
    sudo pg_ctl start -D /var/lib/postgresql/data
  else
    echo "ERROR: Cannot start PostgreSQL. Please start it manually."
    exit 1
  fi
fi

echo "✓ PostgreSQL is running"
echo ""

# ─── 3. Create database and user ──────────────────────────────────────
DB_NAME="cronjobs"
DB_USER="${USER:-postgres}"
DB_PASS=""

echo "Setting up database '$DB_NAME' as user '$DB_USER'..."

# Set password for postgres user if needed
if command -v brew &>/dev/null; then
  # On macOS with brew, use peer auth - no password needed
  PSQL_CMD="psql"
  DB_PASS=""
elif sudo -n psql -U postgres -c "SELECT 1" &>/dev/null 2>&1; then
  PSQL_CMD="sudo -u postgres psql"
  DB_PASS=""
else
  # Try with user
  PSQL_CMD="psql"
  DB_PASS=""
fi

# Create database (ignore if exists)
$PSQL_CMD -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || \
  echo "  Database '$DB_NAME' already exists"

# Set up password auth if needed
if [ -n "$DB_PASS" ]; then
  $PSQL_CMD -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
fi

echo "✓ Database '$DB_NAME' is ready"
echo ""

# ─── 4. Create table and seed data ────────────────────────────────────
echo "Creating table and seeding data..."

$PSQL_CMD -d "$DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS cron_jobs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  schedule VARCHAR(50) NOT NULL,
  description TEXT,
  days VARCHAR(50) DEFAULT '*',
  hours VARCHAR(50) DEFAULT '*',
  minutes VARCHAR(50) DEFAULT '*',
  months VARCHAR(50) DEFAULT '*',
  weekdays VARCHAR(50) DEFAULT '*',
  years VARCHAR(50) DEFAULT '*',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert random cron jobs
INSERT INTO cron_jobs (name, schedule, description, days, hours, minutes, months, weekdays, years) VALUES
  ('daily_backup',         '0 2 * * *',        'Run daily database backup at 2:00 AM',           '*',    '2',    '0',  '*',  '1-7',  '2024-2030'),
  ('hourly_metrics',       '0 * * * *',        'Collect system metrics every hour',              '*',    '*',    '0',  '*',  '1-7',  '2024-2030'),
  ('weekly_report',        '0 9 * * 1',        'Send weekly analytics report every Monday',      '*',    '9',    '0',  '*',  '1',    '2024-2030'),
  ('monthly_cleanup',      '0 3 1 * *',        'Clean up old temp files on the 1st of each month', '1', '3',  '0',  '*',  '1-7',  '2024-2030'),
  ('twice_daily_sync',     '0 6,18 * * *',     'Sync data at 6:00 AM and 6:00 PM daily',        '*',    '6,18', '0',  '*',  '1-7',  '2024-2030'),
  ('health_check',         '*/30 * * * *',     'Check service health every 30 minutes',          '*',    '*',    '*/30','*',  '1-7',  '2024-2030'),
  ('weekend_indexing',     '0 1 * * 0,6',      'Rebuild search index on weekends at 1:00 AM',   '*',    '1',    '0',  '*',  '0,6',  '2024-2030'),
  ('quarterly_audit',      '0 4 1 1,4,7,10 *', 'Run security audit on the 1st of quarter months', '1', '4',  '0',  '1,4,7,10', '1-7', '2024-2030'),
  ('business_cache',       '15 8-18 * * 1-5',  'Refresh cache every 15 min during business hours','*',  '8-18', '15', '*',  '1-5',  '2024-2030'),
  ('log_rotate',           '0 0 * * *',        'Rotate logs and archives at midnight',           '*',    '0',    '0',  '*',  '1-7',  '2024-2030'),
  ('email_digest',         '0 17 * * 1-5',     'Send daily email digest at 5:00 PM (weekdays)', '*',    '17',   '0',  '*',  '1-5',  '2024-2030'),
  ('db_vacuum',            '30 3 * * 0',       'Run PostgreSQL VACUUM on Sundays at 3:30 AM',   '*',    '3',    '30', '*',  '0',    '2024-2030'),
  ('ssl_renewal',          '0 0 1 1 *',        'Check and renew SSL certificates',              '1',    '0',    '0',  '1',   '1',    '2024-2030'),
  ('user_cleanup',         '0 2 15 * *',       'Archive inactive users on the 15th at 2:00 AM', '15',   '2',    '0',  '*',  '1-7',  '2024-2030'),
  ('report_generation',    '0 8 * * 1',        'Generate weekly reports every Monday at 8:00 AM','*',    '8',    '0',  '*',  '1',    '2024-2030')
ON CONFLICT (name) DO UPDATE SET
  schedule = EXCLUDED.schedule,
  description = EXCLUDED.description,
  days = EXCLUDED.days,
  hours = EXCLUDED.hours,
  minutes = EXCLUDED.minutes,
  months = EXCLUDED.months,
  weekdays = EXCLUDED.weekdays,
  years = EXCLUDED.years,
  updated_at = NOW();

SELECT 'Table ready with ' || COUNT(*) || ' cron jobs' FROM cron_jobs;
SQL

echo "✓ Table created and seeded"
echo ""

# ─── 5. Update cron_jobs.json ─────────────────────────────────────────
echo "Syncing cron_jobs.json..."

cat > cron_jobs.json << 'JSON'
[
  {
    "name": "daily_backup",
    "schedule": "0 2 * * *",
    "description": "Run daily database backup at 2:00 AM"
  },
  {
    "name": "hourly_metrics",
    "schedule": "0 * * * *",
    "description": "Collect system metrics every hour"
  },
  {
    "name": "weekly_report",
    "schedule": "0 9 * * 1",
    "description": "Send weekly analytics report every Monday at 9:00 AM"
  },
  {
    "name": "monthly_cleanup",
    "schedule": "0 3 1 * *",
    "description": "Clean up old temp files on the 1st of each month at 3:00 AM"
  },
  {
    "name": "twice_daily_sync",
    "schedule": "0 6,18 * * *",
    "description": "Sync data at 6:00 AM and 6:00 PM daily"
  },
  {
    "name": "health_check",
    "schedule": "*/30 * * * *",
    "description": "Check service health every 30 minutes"
  },
  {
    "name": "weekend_indexing",
    "schedule": "0 1 * * 0,6",
    "description": "Rebuild search index on weekends at 1:00 AM"
  },
  {
    "name": "quarterly_audit",
    "schedule": "0 4 1 1,4,7,10 *",
    "description": "Run security audit on the 1st of quarter months"
  },
  {
    "name": "business_cache",
    "schedule": "15 8-18 * * 1-5",
    "description": "Refresh cache every 15 min during business hours"
  },
  {
    "name": "log_rotate",
    "schedule": "0 0 * * *",
    "description": "Rotate logs and archives at midnight"
  },
  {
    "name": "email_digest",
    "schedule": "0 17 * * 1-5",
    "description": "Send daily email digest at 5:00 PM (weekdays)"
  },
  {
    "name": "db_vacuum",
    "schedule": "30 3 * * 0",
    "description": "Run PostgreSQL VACUUM on Sundays at 3:30 AM"
  },
  {
    "name": "ssl_renewal",
    "schedule": "0 0 1 1 *",
    "description": "Check and renew SSL certificates"
  },
  {
    "name": "user_cleanup",
    "schedule": "0 2 15 * *",
    "description": "Archive inactive users on the 15th at 2:00 AM"
  },
  {
    "name": "report_generation",
    "schedule": "0 8 * * 1",
    "description": "Generate weekly reports every Monday at 8:00 AM"
  }
]
JSON

echo "✓ cron_jobs.json synced"
echo ""

# ─── 6. Verify ────────────────────────────────────────────────────────
echo "=== Verification ==="
echo ""
echo "Database: $DB_NAME"
echo ""
echo "Cron jobs in database:"
$PSQL_CMD -d "$DB_NAME" -c "SELECT name, schedule, description FROM cron_jobs ORDER BY name;"
echo ""
echo "Cron jobs in JSON:"
python3 -c "import json; jobs=json.load(open('cron_jobs.json')); [print(f'  {j[\"name\"]:25s} {j[\"schedule\"]}') for j in jobs]" 2>/dev/null || \
  node -e "const j=require('./cron_jobs.json'); j.forEach(c=>console.log(' '+c.name+' '+c.schedule))"
echo ""
echo "Done! PostgreSQL is set up for cronjobs."
