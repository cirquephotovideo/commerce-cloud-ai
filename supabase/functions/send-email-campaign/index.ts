import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { campaignId } = await req.json();

    // Récupérer la campagne
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError) throw campaignError;

    // Récupérer les abonnés actifs
    const { data: subscribers, error: subscribersError } = await supabaseClient
      .from("newsletter_subscribers")
      .select("email, full_name")
      .eq("status", "active");

    if (subscribersError) throw subscribersError;

    console.log(`Envoi de la campagne "${campaign.title}" à ${subscribers.length} abonnés`);

    // Envoyer les emails en batch
    const sendPromises = subscribers.map((subscriber) =>
      resend.emails.send({
        from: "Newsletter <onboarding@resend.dev>",
        to: [subscriber.email],
        subject: campaign.subject,
        html: campaign.content,
      })
    );

    await Promise.all(sendPromises);

    // Mettre à jour la campagne
    await supabaseClient
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: subscribers.length,
      })
      .eq("id", campaignId);

    console.log(`Campagne envoyée avec succès`);

    return new Response(
      JSON.stringify({ success: true, sent: subscribers.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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