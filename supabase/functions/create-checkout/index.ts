import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutRequest {
  priceId: string;
  billingInterval?: "monthly" | "yearly";
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  logStep("Function started");

  try {
    // Validate Stripe API key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: Stripe API key not configured");
      return new Response(
        JSON.stringify({ error: "Stripe configuration missing" }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
    logStep("Stripe key verified");

    // Validate Supabase configuration
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) {
      logStep("ERROR: Supabase configuration missing");
      return new Response(
        JSON.stringify({ error: "Backend configuration missing" }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user");
    
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !data.user) {
      logStep("ERROR: Authentication failed", { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const user = data.user;
    if (!user.email) {
      logStep("ERROR: User has no email");
      return new Response(
        JSON.stringify({ error: "User email not found" }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse and validate request body
    let body: CheckoutRequest;
    try {
      const rawBody = await req.text();
      logStep("Raw request body received", { body: rawBody });
      body = JSON.parse(rawBody);
      logStep("Request body parsed", body);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logStep("ERROR: Invalid JSON in request body", { error: errMsg });
      return new Response(
        JSON.stringify({ error: "Invalid request format" }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const { priceId, billingInterval } = body;
    
    if (!priceId || typeof priceId !== 'string' || priceId.trim() === '') {
      logStep("ERROR: Price ID missing or invalid", { priceId, receivedBody: body });
      return new Response(
        JSON.stringify({ 
          error: "Price ID is required and must be a valid string",
          receivedBody: body
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!priceId.startsWith('price_')) {
      logStep("ERROR: Invalid Stripe price ID format", { priceId });
      return new Response(
        JSON.stringify({ 
          error: "Invalid Stripe price ID format. Must start with 'price_'",
          receivedPriceId: priceId
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (billingInterval && !['monthly', 'yearly'].includes(billingInterval)) {
      logStep("ERROR: Invalid billing interval", { billingInterval });
      return new Response(
        JSON.stringify({ 
          error: "Billing interval must be 'monthly' or 'yearly'" 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    logStep("Request validated", { priceId, billingInterval });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });
    logStep("Stripe initialized");

    // Check if customer exists
    logStep("Checking for existing customer");
    const customers = await stripe.customers.list({ 
      email: user.email, 
      limit: 1 
    });
    
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer found, will create new");
    }

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "http://localhost:5173";
    logStep("Creating checkout session", { origin });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        user_id: user.id,
        billing_interval: billingInterval || "monthly",
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ url: session.url }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorType = error instanceof Error ? error.constructor.name : typeof error;
    
    logStep("ERROR: Exception caught", { 
      message: errorMessage,
      stack: errorStack,
      type: errorType
    });

    // Check for specific Stripe errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as Stripe.errors.StripeError;
      logStep("Stripe API error", {
        type: stripeError.type,
        code: stripeError.code,
        statusCode: stripeError.statusCode
      });
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: "Check function logs for more information"
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
