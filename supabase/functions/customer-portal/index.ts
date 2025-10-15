import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types pour les réponses structurées
interface SuccessResponse {
  url: string;
  has_customer: true;
}

interface NoCustomerResponse {
  has_customer: false;
  message: string;
  action: "subscribe";
  redirect_to: string;
}

interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

type CustomerPortalResponse = SuccessResponse | NoCustomerResponse | ErrorResponse;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Valider TOUTES les variables d'environnement critiques
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const missingVars: string[] = [];
    if (!stripeKey) missingVars.push("STRIPE_SECRET_KEY");
    if (!supabaseUrl) missingVars.push("SUPABASE_URL");
    if (!supabaseServiceKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");

    if (missingVars.length > 0) {
      const errorMsg = `Missing environment variables: ${missingVars.join(", ")}`;
      logStep("ERROR - Missing env vars", { missing: missingVars });
      return new Response(JSON.stringify({ 
        error: errorMsg,
        code: "MISSING_ENV_VARS"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    logStep("All environment variables verified");

    const supabaseClient = createClient(
      supabaseUrl!,
      supabaseServiceKey!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      logStep("Stripe client initialized");

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      logStep("Stripe customer search completed", { found: customers.data.length });

      if (customers.data.length === 0) {
        logStep("No Stripe customer found, user needs to subscribe first", { email: user.email });
        
        return new Response(JSON.stringify({
          has_customer: false,
          message: "Vous devez d'abord souscrire à un abonnement pour accéder au portail client.",
          action: "subscribe",
          redirect_to: "/pricing"
        } as NoCustomerResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const customerId = customers.data[0].id;
      logStep("Found Stripe customer", { customerId });

      const origin = req.headers.get("origin") || "http://localhost:3000";
      
      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${origin}/dashboard`,
        });
        logStep("Customer portal session created", { sessionId: portalSession.id, url: portalSession.url });

        return new Response(JSON.stringify({ 
          url: portalSession.url,
          has_customer: true
        } as SuccessResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } catch (portalError: any) {
        if (portalError.code === 'customer_portal_not_activated') {
          logStep("ERROR - Customer Portal not activated in Stripe", { error: portalError });
          
          return new Response(JSON.stringify({
            error: "Le portail client Stripe n'est pas activé. Veuillez contacter l'administrateur.",
            code: "PORTAL_NOT_ACTIVATED",
            admin_action_required: "Activate Customer Portal at https://dashboard.stripe.com/settings/billing/portal"
          } as ErrorResponse), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 503,
          });
        }
        throw portalError;
      }
    } catch (stripeError: any) {
      logStep("ERROR - Stripe API error", { 
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        statusCode: stripeError.statusCode
      });

      return new Response(JSON.stringify({
        error: "Erreur lors de la communication avec Stripe",
        code: stripeError.code || "STRIPE_ERROR",
        details: stripeError.message
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in customer-portal", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
