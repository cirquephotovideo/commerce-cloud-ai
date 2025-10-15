import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types pour les réponses structurées
interface SuccessResponse {
  success: true;
  subscription: {
    id: string;
    current_period_end: number;
    plan_name: string;
    billing_interval: string;
  };
}

interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  action?: string;
  redirect_to?: string;
}

type ManageSubscriptionResponse = SuccessResponse | ErrorResponse;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANAGE-SUBSCRIPTION] ${step}${detailsStr}`);
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
      } as ErrorResponse), {
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

    // Valider le body de la requête
    let requestData;
    try {
      requestData = await req.json();
    } catch (parseError) {
      logStep("ERROR - Invalid JSON in request body", { error: parseError });
      return new Response(JSON.stringify({ 
        error: "Invalid JSON in request body",
        code: "INVALID_REQUEST_BODY"
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { newPlanId, billingInterval } = requestData;

    // Valider les champs requis
    if (!newPlanId) {
      return new Response(JSON.stringify({ 
        error: "newPlanId is required",
        code: "MISSING_PLAN_ID"
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!billingInterval || !["monthly", "yearly"].includes(billingInterval)) {
      return new Response(JSON.stringify({ 
        error: "billingInterval must be 'monthly' or 'yearly'",
        code: "INVALID_BILLING_INTERVAL"
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Request data validated", { newPlanId, billingInterval });

    // Get new plan details
    const { data: newPlan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", newPlanId)
      .eq("is_active", true)
      .single();

    if (planError || !newPlan) {
      logStep("ERROR - Plan not found or inactive", { newPlanId, error: planError });
      return new Response(JSON.stringify({ 
        error: `Plan with ID ${newPlanId} not found or inactive`,
        code: "PLAN_NOT_FOUND"
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    logStep("New plan retrieved", { planName: newPlan.name });

    // Vérifier que le plan a un stripe_price_id pour l'intervalle demandé
    const newPriceId = billingInterval === "yearly" 
      ? newPlan.stripe_price_id_yearly 
      : newPlan.stripe_price_id_monthly;

    if (!newPriceId) {
      logStep("ERROR - Price ID not configured for plan", { 
        planName: newPlan.name, 
        billingInterval 
      });
      return new Response(JSON.stringify({ 
        error: `Plan ${newPlan.name} does not have a ${billingInterval} price configured`,
        code: "PRICE_NOT_CONFIGURED"
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Price ID validated", { newPriceId });

    // Encapsuler les appels Stripe
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      logStep("Stripe client initialized");

      // Find Stripe customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      logStep("Stripe customer search completed", { found: customers.data.length });

      if (customers.data.length === 0) {
        logStep("No Stripe customer found", { email: user.email });
        return new Response(JSON.stringify({ 
          error: "You need to subscribe first before you can change your plan",
          code: "NO_STRIPE_CUSTOMER",
          action: "subscribe",
          redirect_to: "/pricing"
        } as ErrorResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      const customerId = customers.data[0].id;
      logStep("Found Stripe customer", { customerId });

      // Get current active subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      logStep("Active subscriptions found", { count: subscriptions.data.length });

      if (subscriptions.data.length === 0) {
        logStep("No active subscription found", { customerId });
        return new Response(JSON.stringify({ 
          error: "No active subscription found. Please subscribe first.",
          code: "NO_ACTIVE_SUBSCRIPTION",
          action: "subscribe",
          redirect_to: "/pricing"
        } as ErrorResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      const currentSubscription = subscriptions.data[0];
      const currentSubscriptionItem = currentSubscription.items.data[0];
      logStep("Current subscription retrieved", { 
        subscriptionId: currentSubscription.id,
        currentPrice: currentSubscriptionItem.price.id
      });

      // Vérifier si l'utilisateur essaie de changer vers le même plan
      if (currentSubscriptionItem.price.id === newPriceId) {
        logStep("User already subscribed to this plan", { priceId: newPriceId });
        return new Response(JSON.stringify({ 
          error: "You are already subscribed to this plan",
          code: "ALREADY_SUBSCRIBED"
        } as ErrorResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Update the subscription
      const updatedSubscription = await stripe.subscriptions.update(currentSubscription.id, {
        items: [
          {
            id: currentSubscriptionItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: "always_invoice",
      });
      logStep("Subscription updated in Stripe", { 
        subscriptionId: updatedSubscription.id,
        newPrice: newPriceId
      });

      // Update user_subscriptions table
      const { error: updateError } = await supabaseClient
        .from("user_subscriptions")
        .update({
          plan_id: newPlanId,
          billing_interval: billingInterval,
          current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("status", "active");

      if (updateError) {
        logStep("WARNING - Stripe updated but Supabase update failed", { 
          error: updateError,
          subscriptionId: updatedSubscription.id
        });
      } else {
        logStep("user_subscriptions updated successfully");
      }

      return new Response(JSON.stringify({ 
        success: true,
        subscription: {
          id: updatedSubscription.id,
          current_period_end: updatedSubscription.current_period_end,
          plan_name: newPlan.name,
          billing_interval: billingInterval
        }
      } as SuccessResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (stripeError: any) {
      logStep("ERROR - Stripe API error", { 
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        statusCode: stripeError.statusCode
      });

      return new Response(JSON.stringify({
        error: "Error communicating with Stripe",
        code: stripeError.code || "STRIPE_ERROR",
        details: stripeError.message
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in manage-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
