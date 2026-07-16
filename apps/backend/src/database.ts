import mysql from "mysql2/promise";

export const database = mysql.createPool({
  uri: process.env.DATABASE_URL ?? "mysql://display:display@localhost:3306/display",
  connectionLimit: 10,
});

