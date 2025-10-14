import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe signature found");

    const body = await req.text();
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { eventType: event.type });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vérifier l'idempotence
    const { data: existingEvent, error: checkError } = await supabaseClient
      .from('webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (checkError) {
      logStep("Error checking event idempotence", { error: checkError.message });
    }

    if (existingEvent) {
      logStep("Event already processed", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, message: "Event already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Logger l'événement
    await supabaseClient.from('webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      event_data: event.data.object,
      processed_at: new Date().toISOString()
    });

    // Traiter les différents types d'événements
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription event", { 
          subscriptionId: subscription.id, 
          status: subscription.status 
        });

        // Récupérer le customer
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (customer.deleted) throw new Error("Customer deleted");

        // Trouver l'utilisateur par email
        const { data: authUser, error: authError } = await supabaseClient.auth.admin.listUsers();
        if (authError) throw authError;

        const user = authUser.users.find(u => u.email === customer.email);
        if (!user) {
          logStep("User not found for customer", { email: customer.email });
          break;
        }

        // Extraire le product_id depuis les items
        const productId = subscription.items.data[0]?.price.product as string;

        // Mettre à jour ou créer l'abonnement
        const { error: upsertError } = await supabaseClient
          .from('user_subscriptions')
          .upsert({
            user_id: user.id,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            product_id: productId,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'stripe_subscription_id'
          });

        if (upsertError) throw upsertError;

        logStep("Subscription updated successfully", { userId: user.id, subscriptionId: subscription.id });

        // Envoyer une notification email (optionnel, via edge function send-notification)
        if (event.type === 'customer.subscription.created') {
          await supabaseClient.functions.invoke('send-notification', {
            body: {
              user_id: user.id,
              type: 'subscription_created',
              title: 'Abonnement activé',
              message: 'Votre abonnement a été activé avec succès.'
            }
          });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing subscription deletion", { subscriptionId: subscription.id });

        const { error: deleteError } = await supabaseClient
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);

        if (deleteError) throw deleteError;

        logStep("Subscription canceled successfully", { subscriptionId: subscription.id });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing payment succeeded", { invoiceId: invoice.id });

        // Enregistrer dans billing_history
        const customer = await stripe.customers.retrieve(invoice.customer as string);
        if (customer.deleted) throw new Error("Customer deleted");

        const { data: authUser, error: authError } = await supabaseClient.auth.admin.listUsers();
        if (authError) throw authError;

        const user = authUser.users.find(u => u.email === customer.email);
        if (!user) {
          logStep("User not found for invoice", { email: customer.email });
          break;
        }

        // Trouver la subscription associée
        const { data: subscription } = await supabaseClient
          .from('user_subscriptions')
          .select('id')
          .eq('stripe_customer_id', invoice.customer as string)
          .eq('status', 'active')
          .maybeSingle();

        await supabaseClient.from('billing_history').insert({
          user_id: user.id,
          subscription_id: subscription?.id,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id: invoice.payment_intent as string,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'paid',
          paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString(),
          description: `Paiement abonnement - ${invoice.id}`
        });

        logStep("Payment recorded successfully", { invoiceId: invoice.id, userId: user.id });

        // Envoyer une notification
        await supabaseClient.functions.invoke('send-notification', {
          body: {
            user_id: user.id,
            type: 'payment_succeeded',
            title: 'Paiement effectué',
            message: `Votre paiement de ${invoice.amount_paid / 100}${invoice.currency.toUpperCase()} a été effectué avec succès.`
          }
        });

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Processing payment failed", { invoiceId: invoice.id });

        const customer = await stripe.customers.retrieve(invoice.customer as string);
        if (customer.deleted) throw new Error("Customer deleted");

        const { data: authUser, error: authError } = await supabaseClient.auth.admin.listUsers();
        if (authError) throw authError;

        const user = authUser.users.find(u => u.email === customer.email);
        if (!user) {
          logStep("User not found for failed invoice", { email: customer.email });
          break;
        }

        // Envoyer une notification d'échec
        await supabaseClient.functions.invoke('send-notification', {
          body: {
            user_id: user.id,
            type: 'payment_failed',
            title: 'Échec de paiement',
            message: 'Le paiement de votre abonnement a échoué. Veuillez mettre à jour vos informations de paiement.'
          }
        });

        logStep("Payment failure notification sent", { invoiceId: invoice.id, userId: user.id });
        break;
      }

      default:
        logStep("Unhandled event type", { eventType: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook handler", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});