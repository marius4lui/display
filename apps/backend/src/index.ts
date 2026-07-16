import "dotenv/config";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import cors from "cors";
import express, { type Request, type Response } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { database } from "./database.js";
import { parseEnvelope, type EncryptedEnvelope } from "./types.js";

const app = express();
const port = Number(process.env.BACKEND_PORT ?? 3001);
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;
const scryptAsync = promisify(scrypt);

app.disable("x-powered-by");
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json({ limit: "12mb" }));

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const safeTokenMatch = (provided: string | undefined, expected: string) => {
  if (!provided) return false;
  const actual = Buffer.from(hash(provided));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
};

function envelopeColumns(envelope: EncryptedEnvelope) {
  return [
    envelope.schemaVersion,
    envelope.encryptionVersion,
    envelope.kdf,
    envelope.iterations,
    envelope.salt,
    envelope.iv,
    envelope.ciphertext,
    envelope.contentHash,
    envelope.byteSize,
  ];
}

function rowToEnvelope(row: RowDataPacket): EncryptedEnvelope {
  return {
    schemaVersion: row.schema_version,
    encryptionVersion: row.encryption_version,
    kdf: row.kdf,
    iterations: row.iterations,
    salt: row.salt,
    iv: row.iv,
    ciphertext: row.ciphertext,
    contentHash: row.content_hash,
    byteSize: row.byte_size,
  };
}

async function authorize(request: Request, response: Response) {
  const [rows] = await database.query<RowDataPacket[]>("SELECT edit_token_hash, owner_id FROM displays WHERE id = ?", [request.params.id]);
  if (!rows[0]) {
    response.status(404).json({ error: "Dashboard nicht gefunden" });
    return false;
  }
  const userId = await authenticatedUser(request);
  if (!safeTokenMatch(request.header("x-edit-token"), rows[0].edit_token_hash) && (!userId || userId !== rows[0].owner_id)) {
    response.status(401).json({ error: "Ungültiger Bearbeitungsschlüssel" });
    return false;
  }
  return true;
}

async function authenticatedUser(request: Request): Promise<string | null> {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const [rows] = await database.query<RowDataPacket[]>("SELECT user_id FROM user_sessions WHERE token_hash=? AND expires_at > NOW()", [hash(authorization.slice(7))]);
  return rows[0]?.user_id ?? null;
}

async function passwordHash(password: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

async function passwordMatches(password: string, stored: string) {
  const [saltValue, hashValue] = stored.split(":");
  if (!saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await scryptAsync(password, Buffer.from(saltValue, "base64url"), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await database.query("INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))", [hash(token), userId]);
  return token;
}

app.get("/", (_request, response) => response.json({ name: "display", service: "backend", apiVersion: 1 }));
app.get("/health", async (_request, response) => {
  try {
    await database.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch {
    response.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.post("/api/auth/register", async (request, response, next) => {
  try {
    const email = String(request.body?.email ?? "").trim().toLowerCase();
    const password = String(request.body?.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return response.status(400).json({ error: "Gültige E-Mail und Passwort mit mindestens 10 Zeichen erforderlich" });
    const id = randomUUID();
    await database.query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [id, email, await passwordHash(password)]);
    response.status(201).json({ user: { id, email }, token: await createSession(id) });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return response.status(409).json({ error: "E-Mail ist bereits registriert" });
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const email = String(request.body?.email ?? "").trim().toLowerCase();
    const password = String(request.body?.password ?? "");
    const [rows] = await database.query<RowDataPacket[]>("SELECT id, email, password_hash FROM users WHERE email=?", [email]);
    if (!rows[0] || !(await passwordMatches(password, rows[0].password_hash))) return response.status(401).json({ error: "Anmeldedaten sind ungültig" });
    response.json({ user: { id: rows[0].id, email: rows[0].email }, token: await createSession(rows[0].id) });
  } catch (error) { next(error); }
});

app.get("/api/me", async (request, response, next) => {
  try {
    const userId = await authenticatedUser(request);
    if (!userId) return response.status(401).json({ error: "Nicht angemeldet" });
    const [rows] = await database.query<RowDataPacket[]>("SELECT id, email, created_at AS createdAt FROM users WHERE id=?", [userId]);
    response.json({ user: rows[0] });
  } catch (error) { next(error); }
});

app.post("/api/dashboards", async (request, response, next) => {
  try {
    const envelope = parseEnvelope(request.body?.envelope);
    const id = randomUUID();
    const editToken = randomBytes(32).toString("base64url");
    const ownerId = await authenticatedUser(request);
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("INSERT INTO displays (id, edit_token_hash, owner_id) VALUES (?, ?, ?)", [id, hash(editToken), ownerId]);
      await connection.query(
        "INSERT INTO display_drafts (display_id, schema_version, encryption_version, kdf, iterations, salt, iv, ciphertext, content_hash, byte_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, ...envelopeColumns(envelope)],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    response.status(201).json({ id, editToken, displayUrl: `${publicBaseUrl}/d/${id}` });
  } catch (error) { next(error); }
});

app.post("/api/dashboards/:id/claim", async (request, response, next) => {
  try {
    const userId = await authenticatedUser(request);
    if (!userId) return response.status(401).json({ error: "Anmeldung erforderlich" });
    const [rows] = await database.query<RowDataPacket[]>("SELECT edit_token_hash, owner_id FROM displays WHERE id=?", [request.params.id]);
    if (!rows[0]) return response.status(404).json({ error: "Dashboard nicht gefunden" });
    if (rows[0].owner_id && rows[0].owner_id !== userId) return response.status(409).json({ error: "Dashboard gehört bereits einem anderen Konto" });
    if (!safeTokenMatch(request.header("x-edit-token"), rows[0].edit_token_hash)) return response.status(401).json({ error: "Ungültiger Bearbeitungsschlüssel" });
    await database.query("UPDATE displays SET owner_id=? WHERE id=?", [userId, request.params.id]);
    response.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/dashboards/:id/draft", async (request, response, next) => {
  try {
    if (!(await authorize(request, response))) return;
    const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM display_drafts WHERE display_id = ?", [request.params.id]);
    if (!rows[0]) return response.status(404).json({ error: "Entwurf nicht gefunden" });
    response.json({ id: request.params.id, envelope: rowToEnvelope(rows[0]), updatedAt: rows[0].updated_at });
  } catch (error) { next(error); }
});

app.put("/api/dashboards/:id/draft", async (request, response, next) => {
  try {
    if (!(await authorize(request, response))) return;
    const envelope = parseEnvelope(request.body?.envelope);
    await database.query(
      "INSERT INTO display_drafts (display_id, schema_version, encryption_version, kdf, iterations, salt, iv, ciphertext, content_hash, byte_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE schema_version=VALUES(schema_version), encryption_version=VALUES(encryption_version), kdf=VALUES(kdf), iterations=VALUES(iterations), salt=VALUES(salt), iv=VALUES(iv), ciphertext=VALUES(ciphertext), content_hash=VALUES(content_hash), byte_size=VALUES(byte_size)",
      [request.params.id, ...envelopeColumns(envelope)],
    );
    response.status(204).end();
  } catch (error) { next(error); }
});

app.post("/api/dashboards/:id/publish", async (request, response, next) => {
  try {
    if (!(await authorize(request, response))) return;
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      const [drafts] = await connection.query<RowDataPacket[]>("SELECT * FROM display_drafts WHERE display_id = ? FOR UPDATE", [request.params.id]);
      if (!drafts[0]) {
        await connection.rollback();
        return response.status(409).json({ error: "Kein Entwurf vorhanden" });
      }
      const [versions] = await connection.query<RowDataPacket[]>("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM display_versions WHERE display_id = ?", [request.params.id]);
      const version = Number(versions[0].next_version);
      const e = rowToEnvelope(drafts[0]);
      await connection.query(
        "INSERT INTO display_versions (display_id, version, schema_version, encryption_version, kdf, iterations, salt, iv, ciphertext, content_hash, byte_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [request.params.id, version, ...envelopeColumns(e)],
      );
      await connection.query("UPDATE displays SET active_version = ? WHERE id = ?", [version, request.params.id]);
      await connection.commit();
      response.status(201).json({ version, displayUrl: `${publicBaseUrl}/d/${request.params.id}` });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (error) { next(error); }
});

app.get("/api/dashboards/:id/versions", async (request, response, next) => {
  try {
    if (!(await authorize(request, response))) return;
    const [rows] = await database.query<RowDataPacket[]>(
      "SELECT v.version, v.schema_version AS schemaVersion, v.content_hash AS contentHash, v.byte_size AS byteSize, v.published_at AS publishedAt, d.active_version = v.version AS active FROM display_versions v JOIN displays d ON d.id=v.display_id WHERE v.display_id=? ORDER BY v.version DESC",
      [request.params.id],
    );
    response.json({ versions: rows });
  } catch (error) { next(error); }
});

app.post("/api/dashboards/:id/versions/:version/activate", async (request, response, next) => {
  try {
    if (!(await authorize(request, response))) return;
    const [result] = await database.query<ResultSetHeader>(
      "UPDATE displays SET active_version=? WHERE id=? AND EXISTS (SELECT 1 FROM display_versions WHERE display_id=? AND version=?)",
      [request.params.version, request.params.id, request.params.id, request.params.version],
    );
    if (!result.affectedRows) return response.status(404).json({ error: "Version nicht gefunden" });
    response.status(204).end();
  } catch (error) { next(error); }
});

app.get("/d/:id", async (request, response, next) => {
  try {
    const [rows] = await database.query<RowDataPacket[]>(
      "SELECT v.*, d.active_version FROM displays d JOIN display_versions v ON v.display_id=d.id AND v.version=d.active_version WHERE d.id=?",
      [request.params.id],
    );
    if (!rows[0]) return response.status(404).json({ error: "Kein veröffentlichtes Dashboard" });
    const etag = `\"${rows[0].content_hash}\"`;
    response.set({ ETag: etag, "Cache-Control": "no-cache" });
    if (request.header("if-none-match") === etag) return response.status(304).end();
    response.json({ id: request.params.id, version: rows[0].active_version, publishedAt: rows[0].published_at, envelope: rowToEnvelope(rows[0]) });
  } catch (error) { next(error); }
});

app.post("/api/dashboards/:id/assets", express.raw({ type: "application/octet-stream", limit: "20mb" }), async (request, response, next) => {
  try {
    if (!(await authorize(request, response))) return;
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) return response.status(400).json({ error: "Asset fehlt" });
    const id = randomUUID();
    const contentHash = hash(request.body);
    await database.query("INSERT INTO encrypted_assets (id, display_id, content_type, byte_size, content_hash, ciphertext) VALUES (?, ?, ?, ?, ?, ?)", [id, request.params.id, request.header("x-asset-type") ?? "application/octet-stream", request.body.length, contentHash, request.body]);
    response.status(201).json({ id, url: `${publicBaseUrl}/assets/${id}`, contentHash });
  } catch (error) { next(error); }
});

app.get("/assets/:id", async (request, response, next) => {
  try {
    const [rows] = await database.query<RowDataPacket[]>("SELECT content_type, ciphertext, content_hash FROM encrypted_assets WHERE id=?", [request.params.id]);
    if (!rows[0]) return response.status(404).end();
    response.set({ "Content-Type": "application/octet-stream", "X-Asset-Type": rows[0].content_type, ETag: `\"${rows[0].content_hash}\"`, "Cache-Control": "public, max-age=31536000, immutable" });
    response.send(rows[0].ciphertext);
  } catch (error) { next(error); }
});

app.use((error: unknown, _request: Request, response: Response, _next: unknown) => {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  console.error("request failed", message);
  response.status(message.includes("ungültig") || message.includes("fehlt") ? 400 : 500).json({ error: message });
});

app.listen(port, () => console.log(`display backend: http://localhost:${port}`));
