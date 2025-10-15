import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("[SCHEDULED-IMPORT] Processing scheduled imports");

    // Récupérer les schedules actifs qui doivent être exécutés
    const { data: schedules, error: fetchError } = await supabaseClient
      .from("import_schedules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString())
      .limit(10);

    if (fetchError) {
      console.error("[SCHEDULED-IMPORT] Error fetching schedules:", fetchError);
      throw fetchError;
    }

    console.log("[SCHEDULED-IMPORT] Found schedules to process:", schedules?.length || 0);

    const results = {
      total: schedules?.length || 0,
      success: 0,
      failed: 0,
      schedules: [] as any[],
    };

    for (const schedule of schedules || []) {
      try {
        console.log("[SCHEDULED-IMPORT] Processing schedule:", schedule.id, schedule.schedule_name);

        // Déterminer la fonction à invoquer
        let functionName = "";
        let functionBody: any = {};

        switch (schedule.schedule_type) {
          case "email":
            functionName = "email-imap-poller";
            functionBody = {
              supplierId: schedule.supplier_id,
            };
            break;
          case "ftp":
            functionName = "supplier-sync-ftp";
            functionBody = {
              supplierId: schedule.supplier_id,
            };
            break;
          case "api":
            functionName = "supplier-sync-api";
            functionBody = {
              supplierId: schedule.supplier_id,
            };
            break;
        }

        if (!functionName) {
          console.error("[SCHEDULED-IMPORT] Unknown schedule type:", schedule.schedule_type);
          continue;
        }

        // Invoquer la fonction
        const { error: invokeError } = await supabaseClient.functions.invoke(functionName, {
          body: functionBody,
        });

        // Calculer le prochain run
        let nextRunAt = new Date();
        switch (schedule.frequency) {
          case "hourly":
            nextRunAt.setHours(nextRunAt.getHours() + 1);
            break;
          case "daily":
            nextRunAt.setDate(nextRunAt.getDate() + 1);
            break;
          case "weekly":
            nextRunAt.setDate(nextRunAt.getDate() + 7);
            break;
          case "monthly":
            nextRunAt.setMonth(nextRunAt.getMonth() + 1);
            break;
        }

        if (invokeError) {
          console.error("[SCHEDULED-IMPORT] Invoke error:", invokeError);
          results.failed++;

          await supabaseClient
            .from("import_schedules")
            .update({
              error_count: schedule.error_count + 1,
              last_run_at: new Date().toISOString(),
              next_run_at: nextRunAt.toISOString(),
            })
            .eq("id", schedule.id);

          results.schedules.push({
            scheduleId: schedule.id,
            status: "failed",
            error: invokeError.message,
          });
        } else {
          console.log("[SCHEDULED-IMPORT] Import succeeded for schedule:", schedule.id);
          results.success++;

          await supabaseClient
            .from("import_schedules")
            .update({
              success_count: schedule.success_count + 1,
              last_run_at: new Date().toISOString(),
              next_run_at: nextRunAt.toISOString(),
            })
            .eq("id", schedule.id);

          results.schedules.push({
            scheduleId: schedule.id,
            status: "success",
          });
        }
      } catch (err: any) {
        console.error("[SCHEDULED-IMPORT] Error processing schedule:", err);
        results.failed++;
        results.schedules.push({
          scheduleId: schedule.id,
          status: "error",
          error: err.message,
        });
      }
    }

    console.log("[SCHEDULED-IMPORT] Processing completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[SCHEDULED-IMPORT] Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
