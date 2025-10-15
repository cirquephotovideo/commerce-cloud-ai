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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    console.log("[RETRY] Starting retry for failed imports", { userId: user.id });

    // Récupérer les erreurs éligibles au retry
    const { data: retryableErrors, error: fetchError } = await supabaseClient
      .rpc("get_retryable_import_errors");

    if (fetchError) {
      console.error("[RETRY] Error fetching retryable errors:", fetchError);
      throw fetchError;
    }

    console.log("[RETRY] Found retryable errors:", retryableErrors?.length || 0);

    const results = {
      total: retryableErrors?.length || 0,
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Retry chaque erreur
    for (const error of retryableErrors || []) {
      try {
        console.log("[RETRY] Retrying error:", error.id, error.error_type);

        // Déterminer la fonction à invoquer selon le type d'erreur
        let functionName = "";
        if (error.error_type.includes("email") || error.error_type.includes("attachment")) {
          functionName = "process-email-attachment";
        } else if (error.error_type.includes("csv")) {
          functionName = "supplier-import-csv";
        } else if (error.error_type.includes("xlsx")) {
          functionName = "supplier-import-xlsx";
        }

        if (!functionName) {
          console.error("[RETRY] Unknown error type:", error.error_type);
          continue;
        }

        // Mettre à jour le retry_count avant de tenter
        await supabaseClient
          .from("import_errors")
          .update({
            retry_count: error.retry_count + 1,
            last_retry_at: new Date().toISOString(),
          })
          .eq("id", error.id);

        // Invoquer la fonction d'import
        const { error: retryError } = await supabaseClient.functions.invoke(functionName, {
          body: {
            errorId: error.id,
            supplierId: error.supplier_id,
            importJobId: error.import_job_id,
          },
        });

        if (retryError) {
          console.error("[RETRY] Retry failed:", retryError);
          results.failed++;
          results.errors.push({
            errorId: error.id,
            message: retryError.message,
          });
        } else {
          console.log("[RETRY] Retry succeeded for error:", error.id);
          results.success++;

          // Marquer comme résolu
          await supabaseClient
            .from("import_errors")
            .update({
              resolved_at: new Date().toISOString(),
              resolution_method: "automatic_retry",
            })
            .eq("id", error.id);
        }
      } catch (err: any) {
        console.error("[RETRY] Error retrying:", err);
        results.failed++;
        results.errors.push({
          errorId: error.id,
          message: err.message,
        });
      }
    }

    console.log("[RETRY] Retry completed:", results);

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
    console.error("[RETRY] Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
