import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardAction, HomeAssistantDataSource, ImmichDataSource, N8nDataSource } from "../dashboard";
import { decryptSecret, encryptSecret } from "./secrets";
import { limitedResponse, safeFetch } from "./safe-fetch";
import { homeAssistantSourceRequest, oauthRefreshForm, providerActionRequest } from "./provider-request";

export type IntegrationCredentials = {
  accessToken?: string; refreshToken?: string; tokenExpiresAt?: string;
  apiKey?: string; webhookAuth?: "none" | "header" | "basic" | "jwt";
  headerName?: string; headerValue?: string; username?: string; password?: string; jwt?: string;
};
export type IntegrationRow = {
  id: string; owner_id: string; provider: "n8n" | "home_assistant" | "immich"; base_url: string; status: string;
  credential_ciphertext: string | null; credential_iv: string | null; credential_auth_tag: string | null;
  metadata: Record<string, unknown>;
};

export function credentials(row: IntegrationRow): IntegrationCredentials {
  if (!row.credential_ciphertext || !row.credential_iv || !row.credential_auth_tag) return {};
  return JSON.parse(decryptSecret({ ciphertext: row.credential_ciphertext, iv: row.credential_iv, auth_tag: row.credential_auth_tag }));
}
export async function ownedIntegration(database: SupabaseClient, ownerId: string, id: string) {
  const { data } = await database.from("integrations").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
  const row = data as IntegrationRow | null;
  if (row) {
    const { data: stored } = await database.from("integration_credentials").select("ciphertext,iv,auth_tag").eq("integration_id", row.id).eq("owner_id", ownerId).maybeSingle();
    if (stored) Object.assign(row, { credential_ciphertext: stored.ciphertext, credential_iv: stored.iv, credential_auth_tag: stored.auth_tag });
  }
  if (!row || row.provider !== "home_assistant") return row;
  const secret = credentials(row);
  if (!secret.refreshToken || !secret.tokenExpiresAt || new Date(secret.tokenExpiresAt).valueOf() > Date.now() + 60_000) return row;
  try {
    const form = oauthRefreshForm(secret.refreshToken, new URL(process.env.PUBLIC_APP_URL ?? row.base_url).origin);
    const response = await safeFetch(`${row.base_url}/auth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, expectedOrigin: new URL(row.base_url).origin });
    const { text } = await limitedResponse(response); if (!response.ok) return row;
    const token = JSON.parse(text) as { access_token: string; refresh_token?: string; expires_in?: number };
    const next = { ...secret, accessToken: token.access_token, refreshToken: token.refresh_token ?? secret.refreshToken, tokenExpiresAt: token.expires_in ? new Date(Date.now()+token.expires_in*1000).toISOString() : undefined };
    const encrypted = encryptSecret(JSON.stringify(next));
    await database.from("integration_credentials").upsert({ integration_id: row.id, owner_id: ownerId, ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.auth_tag, updated_at: new Date().toISOString() });
    return { ...row, credential_ciphertext: encrypted.ciphertext, credential_iv: encrypted.iv, credential_auth_tag: encrypted.auth_tag };
  } catch { return row; }
}
function authHeaders(row: IntegrationRow) {
  const secret = credentials(row); const headers: Record<string, string> = {};
  if (row.provider === "home_assistant" && secret.accessToken) headers.Authorization = `Bearer ${secret.accessToken}`;
  if (row.provider === "n8n" && secret.apiKey) headers["X-N8N-API-KEY"] = secret.apiKey;
  if (row.provider === "immich" && secret.apiKey) headers["x-api-key"] = secret.apiKey;
  return headers;
}
export async function testIntegration(row: IntegrationRow) {
  const url = row.provider === "home_assistant" ? `${row.base_url}/api/` : row.provider === "immich" ? `${row.base_url}/api-keys/me` : credentials(row).apiKey ? `${row.base_url}/api/v1/workflows?limit=1` : `${row.base_url}/healthz`;
  const response = await safeFetch(url, { headers: authHeaders(row), expectedOrigin: new URL(row.base_url).origin });
  await limitedResponse(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { version: response.headers.get("x-n8n-version") ?? null };
}
export async function discoverIntegration(row: IntegrationRow, resource: string) {
  const routes: Record<string, string> = row.provider === "n8n"
    ? { workflows: "/api/v1/workflows?active=true&limit=100", executions: "/api/v1/executions?limit=20" }
    : row.provider === "immich" ? { albums: "/albums" }
    : { states: "/api/states", services: "/api/services", calendars: "/api/calendars" };
  const path = routes[resource]; if (!path) throw new Error("Nicht unterstützte Discovery-Ressource");
  const response = await safeFetch(`${row.base_url}${path}`, { headers: authHeaders(row), expectedOrigin: new URL(row.base_url).origin });
  const { text } = await limitedResponse(response); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value = JSON.parse(text);
  if (row.provider === "n8n" && resource === "workflows") {
    const workflows = Array.isArray(value) ? value : value.data ?? [];
    return workflows.map((workflow: Record<string, unknown>) => ({
      id: workflow.id, name: workflow.name, active: workflow.active,
      webhooks: (Array.isArray(workflow.nodes) ? workflow.nodes : []).flatMap((node: Record<string, unknown>) => {
        if (node.type !== "n8n-nodes-base.webhook") return [];
        const parameters = node.parameters as Record<string, unknown> | undefined;
        const rawPath = String(parameters?.path ?? "").replace(/^\/+/, "");
        return rawPath ? [{ nodeId: node.id, nodeName: node.name, path: `/webhook/${rawPath}`, method: String(parameters?.httpMethod ?? "GET").toUpperCase() }] : [];
      }),
    }));
  }
  return value;
}
export async function executeIntegrationAction(row: IntegrationRow, action: DashboardAction, context: Record<string, unknown>) {
  const built = providerActionRequest(row.base_url, action, credentials(row), context);
  const { url, method, headers, body } = built;
  const response = await safeFetch(url, { method, headers, body: method === "GET" ? undefined : JSON.stringify(body), timeoutMs: action.timeoutMs ?? 20_000, expectedOrigin: new URL(row.base_url).origin });
  const { text } = await limitedResponse(response); if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (row.provider === "n8n" && contentType && !contentType.includes("json") && !contentType.startsWith("text/")) throw new Error("Webhook-Antwort muss JSON oder Text sein");
  let value: unknown = text; try { value = text ? JSON.parse(text) : null; } catch { /* text is permitted */ }
  return { value, status: response.status };
}

export async function executeHomeAssistantSource(row: IntegrationRow, source: HomeAssistantDataSource) {
  const token = credentials(row).accessToken ?? ""; const headers = { Authorization: `Bearer ${token}` };
  if (source.resource === "service_response" && source.service) {
    const { domain, service, target = {}, data = {} } = source.service;
    const path = `/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}?return_response`;
    const response = await safeFetch(`${row.base_url}${path}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ ...data, ...target.entityId?.length ? { entity_id: target.entityId } : {}, ...target.deviceId?.length ? { device_id: target.deviceId } : {}, ...target.areaId?.length ? { area_id: target.areaId } : {} }), expectedOrigin: new URL(row.base_url).origin });
    const result = await limitedResponse(response); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { value: JSON.parse(result.text) };
  }
  const response = await safeFetch(homeAssistantSourceRequest(row.base_url, source), { headers, expectedOrigin: new URL(row.base_url).origin });
  const result = await limitedResponse(response); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (source.resource === "camera") return { image: result.bytes, contentType: response.headers.get("content-type") ?? "image/jpeg" };
  let value = JSON.parse(result.text);
  if (source.resource === "states" && source.entityIds && source.entityIds.length > 1 && Array.isArray(value)) {
    const selected = new Set(source.entityIds);
    value = value.filter((item: { entity_id?: string }) => !!item.entity_id && selected.has(item.entity_id));
  }
  if (source.attribute && value && !Array.isArray(value) && typeof value === "object") value = (value as { attributes?: Record<string, unknown> }).attributes?.[source.attribute];
  return { value };
}

export async function executeN8nSource(row: IntegrationRow, source: N8nDataSource) {
  const query = new URLSearchParams({ limit: source.resource === "workflow_status" ? "1" : "20" });
  if (source.workflowId) query.set("workflowId", source.workflowId);
  const response = await safeFetch(`${row.base_url}/api/v1/executions?${query}`, { headers: authHeaders(row), expectedOrigin: new URL(row.base_url).origin });
  const { text } = await limitedResponse(response); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value = JSON.parse(text);
  return { value: source.resource === "workflow_status" ? value?.data?.[0] ?? null : value };
}

export type ImmichAsset = {
  id: string;
  type: "IMAGE";
  originalFileName: string;
  fileCreatedAt?: string;
  thumbhash?: string | null;
  description?: string;
};

export async function executeImmichSource(row: IntegrationRow, source: ImmichDataSource) {
  const limit = Math.max(1, Math.min(1000, source.maxAssets ?? 500));
  const items: Array<Record<string, unknown>> = [];
  for (let page = 1; items.length < limit; page++) {
    const response = await safeFetch(`${row.base_url}/search/metadata`, {
      method: "POST",
      headers: { ...authHeaders(row), "Content-Type": "application/json" },
      body: JSON.stringify({ albumIds: [source.albumId], type: "IMAGE", order: "desc", page, size: Math.min(100, limit - items.length) }),
      expectedOrigin: new URL(row.base_url).origin,
    });
    const { text } = await limitedResponse(response); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const assets = (JSON.parse(text) as { assets?: { items?: Array<Record<string, unknown>>; nextPage?: string | null } }).assets;
    items.push(...(assets?.items ?? []));
    if (!assets?.nextPage || !assets.items?.length) break;
  }
  const assets: ImmichAsset[] = items.slice(0, limit).flatMap((asset) => {
    if (asset.type !== "IMAGE" || typeof asset.id !== "string") return [];
    const exif = asset.exifInfo && typeof asset.exifInfo === "object" ? asset.exifInfo as Record<string, unknown> : undefined;
    return [{
      id: asset.id,
      type: "IMAGE",
      originalFileName: String(asset.originalFileName ?? "Foto"),
      fileCreatedAt: typeof asset.fileCreatedAt === "string" ? asset.fileCreatedAt : undefined,
      thumbhash: typeof asset.thumbhash === "string" ? asset.thumbhash : null,
      description: typeof exif?.description === "string" ? exif.description : undefined,
    }];
  });
  return { value: { albumId: source.albumId, assets } };
}

export async function fetchImmichThumbnail(row: IntegrationRow, assetId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) throw new Error("Ungültige Asset-ID");
  const response = await safeFetch(`${row.base_url}/assets/${encodeURIComponent(assetId)}/thumbnail?size=preview`, {
    headers: authHeaders(row), expectedOrigin: new URL(row.base_url).origin,
  });
  if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status }); }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) { await response.body?.cancel(); throw new Error("Immich lieferte kein Bild"); }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 10 * 1024 * 1024) { await response.body?.cancel(); throw new Error("Bild überschreitet 10 MB"); }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Bild überschreitet 10 MB");
  return { bytes, contentType };
}

export async function immichAssetBelongsToAlbum(row: IntegrationRow, albumId: string, assetId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(albumId) || !/^[0-9a-f-]{36}$/i.test(assetId)) return false;
  const response = await safeFetch(`${row.base_url}/search/metadata`, {
    method: "POST", headers: { ...authHeaders(row), "Content-Type": "application/json" },
    body: JSON.stringify({ albumIds: [albumId], id: assetId, type: "IMAGE", page: 1, size: 1 }),
    expectedOrigin: new URL(row.base_url).origin,
  });
  const { text } = await limitedResponse(response); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = JSON.parse(text) as { assets?: { items?: Array<{ id?: string }> } };
  return payload.assets?.items?.some((asset) => asset.id === assetId) === true;
}
