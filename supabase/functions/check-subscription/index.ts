import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;
    
    if (userError || !user) {
      logStep('Authentication error', { error: userError?.message || 'User not found' });
      
      // Détecter token expiré/invalide spécifiquement
      const errorMsg = userError?.message || '';
      if (errorMsg.includes('JWT') || errorMsg.includes('expired') || errorMsg.includes('invalid') || errorMsg.includes('token')) {
        return new Response(JSON.stringify({
          subscribed: false,
          error: 'Token expired or invalid',
          code: 'TOKEN_EXPIRED',
          expired: true
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error('User authentication failed');
    }
    
    if (!user.email) throw new Error("User email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user is super_admin or admin
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData && (roleData.role === "super_admin" || roleData.role === "admin")) {
      logStep("Admin user detected, granting unlimited access", { role: roleData.role });
      
      // Get or create Super Admin plan
      const { data: adminPlan } = await supabaseClient
        .from("subscription_plans")
        .select("id, name, limits")
        .eq("name", "Super Admin")
        .single();

      return new Response(JSON.stringify({
        subscribed: true,
        plan_id: adminPlan?.id || null,
        product_id: "admin_access",
        subscription_end: null,
        limits: adminPlan?.limits || {
          product_analyses: -1,
          google_shopping_searches: -1,
          price_alerts: -1,
          image_optimizations: -1
        },
        is_admin: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan_id: null,
        product_id: null,
        subscription_end: null,
        limits: null,
        is_admin: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Vérifier d'abord s'il y a un essai actif
    const { data: trialData } = await supabaseClient
      .from("user_subscriptions")
      .select("trial_start, trial_end, status, plan_id")
      .eq("user_id", user.id)
      .in("status", ["trialing", "active"])
      .maybeSingle();

    if (trialData && trialData.status === "trialing") {
      const now = new Date();
      const trialEnd = new Date(trialData.trial_end);
      
      if (now < trialEnd) {
        // Essai toujours actif - limiter à 20 produits
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Récupérer les infos du plan pour le nom
        const { data: planData } = await supabaseClient
          .from("subscription_plans")
          .select("name")
          .eq("id", trialData.plan_id)
          .single();

        // Forcer les limites à 20 produits pendant l'essai
        const trialLimits = {
          product_analyses: 20,
          google_shopping_searches: 20,
          price_alerts: -1,
          image_optimizations: -1
        };

        logStep("Active trial found with 20 product limit", { daysRemaining, trialEnd: trialData.trial_end, limits: trialLimits });

        return new Response(JSON.stringify({
          subscribed: true,
          is_trial: true,
          trial_days_remaining: daysRemaining,
          trial_end: trialData.trial_end,
          plan_name: planData?.name || "Starter",
          limits: trialLimits
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // Essai expiré - mettre à jour le statut
        logStep("Trial expired, updating status");
        await supabaseClient
          .from("user_subscriptions")
          .update({ status: "expired" })
          .eq("user_id", user.id)
          .eq("status", "trialing");
        
        return new Response(JSON.stringify({
          subscribed: false,
          is_trial: false,
          trial_expired: true,
          limits: null
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let planId = null;
    let subscriptionEnd = null;
    let limits = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      productId = subscription.items.data[0].price.product as string;
      logStep("Determined product ID", { productId });

      // Get plan details from database
      const { data: planData } = await supabaseClient
        .from("subscription_plans")
        .select("id, name, limits")
        .eq("stripe_product_id", productId)
        .single();

      if (planData) {
        planId = planData.id;
        limits = planData.limits;
        logStep("Found plan in database", { planId, planName: planData.name, limits });
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan_id: planId,
      product_id: productId,
      subscription_end: subscriptionEnd,
      limits: limits,
      is_admin: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
