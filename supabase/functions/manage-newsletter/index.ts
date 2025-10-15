import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewsletterRequest {
  action: 'subscribe' | 'unsubscribe';
  email: string;
  full_name?: string;
}

interface NewsletterError {
  error: string;
  code: 'INVALID_ACTION' | 'INVALID_EMAIL' | 'MISSING_EMAIL' | 'INVALID_REQUEST_BODY' | 'INTERNAL_ERROR';
  details?: any;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse and validate request body
    let requestBody: Partial<NewsletterRequest>;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('[NEWSLETTER] Invalid JSON:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        code: 'INVALID_REQUEST_BODY'
      } as NewsletterError), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { action, email, full_name } = requestBody;

    // Validation action
    if (!action || !['subscribe', 'unsubscribe'].includes(action)) {
      return new Response(JSON.stringify({ 
        error: 'action must be either "subscribe" or "unsubscribe"',
        code: 'INVALID_ACTION'
      } as NewsletterError), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validation email
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return new Response(JSON.stringify({ 
        error: 'email is required and must be non-empty',
        code: 'MISSING_EMAIL'
      } as NewsletterError), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return new Response(JSON.stringify({ 
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      } as NewsletterError), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('[NEWSLETTER] Request validated:', { 
      action, 
      email: email.trim().toLowerCase(),
      timestamp: new Date().toISOString()
    });

    try {
      if (action === "subscribe") {
        const { error: dbError } = await supabaseClient
          .from("newsletter_subscribers")
          .upsert({
            email: email.trim().toLowerCase(),
            full_name: full_name || null,
            status: "active",
            subscribed_at: new Date().toISOString(),
          }, {
            onConflict: "email",
          });

        if (dbError) throw dbError;

        console.log('[NEWSLETTER] Subscription successful:', email.trim().toLowerCase());
        return new Response(
          JSON.stringify({ success: true, message: "Inscription réussie" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const { error: dbError } = await supabaseClient
          .from("newsletter_subscribers")
          .update({
            status: "unsubscribed",
            unsubscribed_at: new Date().toISOString(),
          })
          .eq("email", email.trim().toLowerCase());

        if (dbError) throw dbError;

        console.log('[NEWSLETTER] Unsubscription successful:', email.trim().toLowerCase());
        return new Response(
          JSON.stringify({ success: true, message: "Désinscription réussie" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (dbError: any) {
      console.error('[NEWSLETTER] Database error:', {
        message: dbError.message,
        code: dbError.code,
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({ 
        error: 'Database operation failed',
        code: 'INTERNAL_ERROR',
        details: dbError.message
      } as NewsletterError), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  } catch (error: any) {
    console.error("[NEWSLETTER] Unexpected error:", {
      message: error.message,
      timestamp: new Date().toISOString()
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        code: 'INTERNAL_ERROR'
      } as NewsletterError),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});