import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "cronjobs",
  user: "postgres",
  password: "postgress",
});

export default pool;
