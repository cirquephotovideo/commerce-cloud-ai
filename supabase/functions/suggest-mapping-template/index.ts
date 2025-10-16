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

    const { columns } = await req.json();

    if (!columns || !Array.isArray(columns)) {
      throw new Error("Missing columns array");
    }

    console.log("[SUGGEST-MAPPING] Analyzing columns:", columns);

    // Récupérer tous les templates de l'utilisateur
    const { data: templates, error: fetchError } = await supabaseClient
      .from("supplier_mapping_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("usage_count", { ascending: false });

    if (fetchError) {
      console.error("[SUGGEST-MAPPING] Error fetching templates:", fetchError);
      throw fetchError;
    }

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          template: null,
          message: "No templates found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculer le score de similarité pour chaque template
    const normalizedColumns = columns.map((col: string) => 
      col.toLowerCase().trim().replace(/[_\s-]+/g, "")
    );

    let bestTemplate = null;
    let bestScore = 0;

    for (const template of templates) {
      const mappingConfig = template.column_mapping as any;
      const mappedColumns = Object.values(mappingConfig).filter(Boolean) as string[];
      
      // Compter combien de colonnes du fichier correspondent au template
      let matchCount = 0;
      for (const col of normalizedColumns) {
        for (const mappedCol of mappedColumns) {
          const normalizedMapped = String(mappedCol).toLowerCase().trim().replace(/[_\s-]+/g, "");
          if (col.includes(normalizedMapped) || normalizedMapped.includes(col)) {
            matchCount++;
            break;
          }
        }
      }

      const score = matchCount / Math.max(normalizedColumns.length, mappedColumns.length);

      console.log("[SUGGEST-MAPPING] Template score:", {
        templateName: template.template_name,
        score,
        matchCount,
      });

      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    // Retourner le meilleur template si le score est > 30%
    if (bestScore > 0.3 && bestTemplate) {
      console.log("[SUGGEST-MAPPING] Best template found:", bestTemplate.template_name, "score:", bestScore);

      return new Response(
        JSON.stringify({
          success: true,
          template: bestTemplate,
          score: bestScore,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        template: null,
        message: "No matching template found (score too low)",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
    );
  } catch (error: any) {
    console.error("[SUGGEST-MAPPING] Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
