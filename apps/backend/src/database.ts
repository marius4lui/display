import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const database = mysql.createPool({
  uri: process.env.DATABASE_URL ?? "mysql://display:display@localhost:3306/display",
  connectionLimit: 10,
});

export async function runMigrations() {
  const migrationsDirectory = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "../../packages/database/migrations");
  const sql = await readFile(path.join(migrationsDirectory, "001_initial.sql"), "utf8");
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  const connection = await database.getConnection();
  try {
    for (const statement of statements) await connection.query(statement);
  } finally {
    connection.release();
  }
}
