import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  port: 3306,
  database: "cronjobs",
  user: "root",
  password: "postgress",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
