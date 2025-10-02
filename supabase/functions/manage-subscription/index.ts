import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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

    const { newPlanId, billingInterval } = await req.json();
    if (!newPlanId || !billingInterval) {
      throw new Error("newPlanId and billingInterval are required");
    }
    logStep("Request data parsed", { newPlanId, billingInterval });

    // Get new plan details
    const { data: newPlan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", newPlanId)
      .single();

    if (planError || !newPlan) {
      throw new Error("Plan not found");
    }
    logStep("New plan retrieved", { planName: newPlan.name });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get current active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new Error("No active subscription found");
    }

    const currentSubscription = subscriptions.data[0];
    const currentSubscriptionItem = currentSubscription.items.data[0];
    logStep("Current subscription found", { subscriptionId: currentSubscription.id });

    // Determine the new price ID
    const newPriceId = billingInterval === "yearly" 
      ? newPlan.stripe_price_id_yearly 
      : newPlan.stripe_price_id_monthly;

    if (!newPriceId) {
      throw new Error("Price ID not found for the selected plan and billing interval");
    }
    logStep("New price ID determined", { newPriceId });

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
    logStep("Subscription updated", { subscriptionId: updatedSubscription.id });

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
      logStep("Error updating user_subscriptions", { error: updateError });
    } else {
      logStep("user_subscriptions updated successfully");
    }

    return new Response(JSON.stringify({ 
      success: true,
      subscription: {
        id: updatedSubscription.id,
        current_period_end: updatedSubscription.current_period_end,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in manage-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
