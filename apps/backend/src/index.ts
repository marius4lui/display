import "dotenv/config";
import cors from "cors";
import express from "express";
import { database } from "./database.js";

const app = express();
const port = Number(process.env.BACKEND_PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({ name: "display", service: "backend" });
});

app.get("/health", async (_request, response) => {
  try {
    await database.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.listen(port, () => {
  console.log(`display backend: http://localhost:${port}`);
});

