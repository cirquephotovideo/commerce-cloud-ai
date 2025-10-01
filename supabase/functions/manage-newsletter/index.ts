import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, email, full_name } = await req.json();

    if (action === "subscribe") {
      const { data, error } = await supabaseClient
        .from("newsletter_subscribers")
        .upsert({
          email,
          full_name: full_name || null,
          status: "active",
          subscribed_at: new Date().toISOString(),
        }, {
          onConflict: "email",
        });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Inscription réussie" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "unsubscribe") {
      const { error } = await supabaseClient
        .from("newsletter_subscribers")
        .update({
          status: "unsubscribed",
          unsubscribed_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Désinscription réussie" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      throw new Error("Action invalide");
    }
  } catch (error: any) {
    console.error("Erreur:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});