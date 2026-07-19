import { NextRequest, NextResponse } from "next/server";
import type { DataSource } from "../../../../lib/dashboard";
import { executeDataSource } from "../../../../lib/server/data-source";
import { apiError } from "../../../../lib/server/http";
import { adminClient } from "../../../../lib/server/supabase";
import { executeHomeAssistantSource, executeImmichSource, executeN8nSource, ownedIntegration } from "../../../../lib/server/integrations";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const expected = process.env.COLLECTOR_TOKEN;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return apiError("UNAUTHORIZED", "Collector nicht autorisiert", 401);
  const database = adminClient();
  const { data: jobs, error } = await database.rpc("claim_due_data_sources", { claim_seconds: 45 });
  if (error) return apiError("CLAIM_FAILED", error.message, 500);
  let succeeded = 0;
  for (const job of jobs ?? []) {
    const checkedAt = new Date().toISOString();
    try {
      const source = job.source as DataSource;
      if (source.type === "action_response") {
        await database.from("data_source_runtime").update({ checked_at: checkedAt, lease_until: null }).eq("display_id", job.display_id).eq("source_id", job.source_id);
        continue;
      }
      let value: unknown; let durationMs: number | null = null; let httpStatus: number | null = null;
      if (source.type === "home_assistant" || source.type === "n8n" || source.type === "immich") {
        const integration = await ownedIntegration(database, job.owner_id, source.integrationId);
        if (!integration || integration.status !== "active" || integration.provider !== source.type) throw new Error("Integration ist nicht aktiv");
        const started = performance.now();
        const managed = source.type === "home_assistant" ? await executeHomeAssistantSource(integration, source) : source.type === "n8n" ? await executeN8nSource(integration, source) : await executeImmichSource(integration, source);
        if ("image" in managed) throw new Error("Binäre Kameraquellen werden nicht historisiert");
        value = managed.value; durationMs = Math.round(performance.now() - started); httpStatus = 200;
      } else {
        const result = await executeDataSource(source, job.owner_id, database);
        value = result.value; durationMs = result.durationMs; httpStatus = result.status;
      }
      await database.from("data_source_runtime").update({ value, checked_at: checkedAt, succeeded_at: checkedAt, duration_ms: durationMs, http_status: httpStatus, error: null, lease_until: null }).eq("display_id", job.display_id).eq("source_id", job.source_id);
      await database.from("data_source_samples").insert({ display_id: job.display_id, source_id: job.source_id, sampled_at: checkedAt, value });
      succeeded++;
    } catch (failure) {
      const item = failure as Error & { status?: number };
      await database.from("data_source_runtime").update({ checked_at: checkedAt, http_status: item.status ?? null, error: item.message.slice(0, 500), lease_until: null }).eq("display_id", job.display_id).eq("source_id", job.source_id);
    }
  }
  await database.from("data_source_samples").delete().lt("sampled_at", new Date(Date.now() - 7 * 86400_000).toISOString());
  return NextResponse.json({ claimed: jobs?.length ?? 0, succeeded });
}
