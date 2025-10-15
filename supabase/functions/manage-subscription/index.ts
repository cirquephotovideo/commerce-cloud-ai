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

interface CompletePaymentResponse {
  error: string;
  code: "PAYMENT_ACTION_REQUIRED";
  action: "complete_payment";
  hosted_invoice_url?: string;
  payment_intent_status?: string;
}

type ManageSubscriptionResponse = SuccessResponse | ErrorResponse | CompletePaymentResponse;

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
    if (!authHeader) {
      logStep("ERROR - No authorization header");
      return new Response(JSON.stringify({ 
        error: "Authorization header required",
        code: "NO_AUTH_HEADER"
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR - Authentication failed", { error: userError.message });
      return new Response(JSON.stringify({ 
        error: "Invalid or expired token",
        code: "AUTHENTICATION_FAILED",
        details: userError.message
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR - User missing email");
      return new Response(JSON.stringify({ 
        error: "User not authenticated or email not available",
        code: "AUTHENTICATION_FAILED"
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
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

    // Valider format UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(newPlanId)) {
      return new Response(JSON.stringify({ 
        error: 'newPlanId must be a valid UUID',
        code: 'INVALID_PLAN_ID'
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
      .maybeSingle();

    if (planError) {
      logStep("ERROR - Database error fetching plan", { newPlanId, error: planError });
      return new Response(JSON.stringify({ 
        error: "Database error fetching plan",
        code: "DATABASE_ERROR",
        details: planError.message
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!newPlan) {
      logStep("ERROR - Plan not found or inactive", { newPlanId });
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

      // Update the subscription with expanded invoice data
      const updatedSubscription = await stripe.subscriptions.update(currentSubscription.id, {
        items: [
          {
            id: currentSubscriptionItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: "always_invoice",
        expand: ["latest_invoice.payment_intent"],
      });
      logStep("Subscription updated in Stripe", { 
        subscriptionId: updatedSubscription.id,
        newPrice: newPriceId,
        status: updatedSubscription.status
      });

      // Check if payment action is required
      const latestInvoice = updatedSubscription.latest_invoice as any;
      const paymentIntent = latestInvoice?.payment_intent;
      const paymentIntentStatus = paymentIntent?.status;

      logStep("Payment status check", {
        subscriptionStatus: updatedSubscription.status,
        invoiceId: latestInvoice?.id,
        paymentIntentStatus,
        hostedInvoiceUrl: latestInvoice?.hosted_invoice_url
      });

      if (
        updatedSubscription.status === "incomplete" ||
        (paymentIntentStatus && ["requires_payment_method", "requires_action"].includes(paymentIntentStatus))
      ) {
        logStep("Payment action required", {
          invoiceId: latestInvoice?.id,
          hostedInvoiceUrl: latestInvoice?.hosted_invoice_url,
          paymentIntentStatus,
          nextAction: paymentIntent?.next_action
        });

        return new Response(JSON.stringify({
          error: "Payment action required to complete the plan change",
          code: "PAYMENT_ACTION_REQUIRED",
          action: "complete_payment",
          hosted_invoice_url: latestInvoice?.hosted_invoice_url,
          payment_intent_status: paymentIntentStatus
        } as CompletePaymentResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }

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
        statusCode: stripeError.statusCode,
        raw: stripeError.raw
      });

      // Mapper les erreurs Stripe vers des messages user-friendly
      let userMessage = 'Error communicating with Stripe';
      let httpStatus = 502;
      
      if (stripeError.type === 'StripeCardError') {
        userMessage = 'Payment method declined. Please use a different card.';
        httpStatus = 402;
      } else if (stripeError.type === 'StripeInvalidRequestError') {
        userMessage = 'Invalid subscription configuration. Please contact support.';
        httpStatus = 400;
      } else if (stripeError.type === 'StripeRateLimitError') {
        userMessage = 'Too many requests. Please try again in a few seconds.';
        httpStatus = 429;
      } else if (stripeError.type === 'StripeAuthenticationError') {
        userMessage = 'Stripe authentication error. Please contact support.';
        httpStatus = 500;
      } else if (stripeError.type === 'StripeAPIError') {
        userMessage = 'Stripe service temporarily unavailable. Please try again.';
        httpStatus = 503;
      }

      return new Response(JSON.stringify({
        error: userMessage,
        code: stripeError.code || "STRIPE_ERROR",
        details: stripeError.message
      } as ErrorResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: httpStatus,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in manage-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: "INTERNAL_ERROR"
    } as ErrorResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
