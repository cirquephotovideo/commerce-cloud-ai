import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  honeypot?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { name, email, subject, message, honeypot }: ContactRequest = await req.json();

    console.log("[CONTACT] Received contact form submission from:", email);

    // Anti-spam: Honeypot check
    if (honeypot && honeypot.length > 0) {
      console.log("[CONTACT] Bot detected via honeypot:", email);
      return new Response(
        JSON.stringify({ error: "Invalid submission" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validation
    if (!name || name.length < 2 || name.length > 100) {
      return new Response(
        JSON.stringify({ error: "Le nom doit contenir entre 2 et 100 caractères" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message || message.length < 10 || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Le message doit contenir entre 10 et 2000 caractères" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: Check if user sent more than 3 messages in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentMessages, error: rateLimitError } = await supabase
      .from("contact_messages")
      .select("id")
      .eq("sender_email", email)
      .gte("created_at", twentyFourHoursAgo);

    if (rateLimitError) {
      console.error("[CONTACT] Rate limit check error:", rateLimitError);
    }

    if (recentMessages && recentMessages.length >= 3) {
      console.log("[CONTACT] Rate limit exceeded for:", email);
      return new Response(
        JSON.stringify({ error: "Vous avez atteint la limite de 3 messages par 24 heures" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP and User-Agent
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Save to database
    const { error: dbError } = await supabase
      .from("contact_messages")
      .insert({
        sender_name: name,
        sender_email: email,
        subject: subject || "Sans sujet",
        message: message,
        ip_address: ipAddress,
        user_agent: userAgent,
        status: "new"
      });

    if (dbError) {
      console.error("[CONTACT] Database error:", dbError);
      throw new Error("Erreur lors de la sauvegarde du message");
    }

    // Send email to admin
    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .field { margin-bottom: 20px; }
            .label { font-weight: bold; color: #4b5563; display: block; margin-bottom: 5px; }
            .value { background: white; padding: 12px; border-radius: 5px; border-left: 3px solid #667eea; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📧 Nouveau Message de Contact</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Commerce Cloud AI</p>
            </div>
            <div class="content">
              <div class="field">
                <span class="label">👤 Nom</span>
                <div class="value">${name}</div>
              </div>
              <div class="field">
                <span class="label">📧 Email</span>
                <div class="value"><a href="mailto:${email}">${email}</a></div>
              </div>
              <div class="field">
                <span class="label">📋 Sujet</span>
                <div class="value">${subject || "Sans sujet"}</div>
              </div>
              <div class="field">
                <span class="label">💬 Message</span>
                <div class="value">${message.replace(/\n/g, "<br>")}</div>
              </div>
              <div class="field">
                <span class="label">🌍 Informations Techniques</span>
                <div class="value">
                  IP: ${ipAddress}<br>
                  User-Agent: ${userAgent}<br>
                  Date: ${new Date().toLocaleString("fr-FR")}
                </div>
              </div>
            </div>
            <div class="footer">
              <p>Ce message a été envoyé via le formulaire de contact de Commerce Cloud AI</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const adminEmailResult = await resend.emails.send({
      from: "Commerce Cloud AI <noreply@resend.dev>",
      to: ["arnaud@gredai.com"],
      subject: `[Contact Commerce Cloud AI] ${subject || "Nouveau message"}`,
      html: adminEmailHtml,
      replyTo: email,
    });

    if (adminEmailResult.error) {
      console.error("[CONTACT] Admin email error:", adminEmailResult.error);
      throw new Error("Erreur lors de l'envoi de l'email à l'administrateur");
    }

    console.log("[CONTACT] Admin email sent successfully:", adminEmailResult.data?.id);

    // Send confirmation email to visitor
    const confirmationEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .message-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ Message Bien Reçu !</h1>
            </div>
            <div class="content">
              <p>Bonjour ${name},</p>
              <p>Nous avons bien reçu votre message et nous vous remercions de nous avoir contactés.</p>
              <p><strong>Notre équipe vous répondra dans un délai de 24 à 48 heures.</strong></p>
              
              <div class="message-box">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Rappel de votre message :</p>
                <p style="margin: 0;"><strong>Sujet :</strong> ${subject || "Sans sujet"}</p>
                <p style="margin: 10px 0 0 0;">${message.replace(/\n/g, "<br>")}</p>
              </div>

              <p>Si vous avez des questions urgentes, n'hésitez pas à nous contacter directement à <a href="mailto:arnaud@gredai.com">arnaud@gredai.com</a>.</p>
              
              <p>Cordialement,<br><strong>L'équipe Commerce Cloud AI</strong></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Commerce Cloud AI. Tous droits réservés.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const confirmationEmailResult = await resend.emails.send({
      from: "Commerce Cloud AI <noreply@resend.dev>",
      to: [email],
      subject: "Nous avons bien reçu votre message",
      html: confirmationEmailHtml,
    });

    if (confirmationEmailResult.error) {
      console.error("[CONTACT] Confirmation email error:", confirmationEmailResult.error);
      // Don't throw here - admin email was sent successfully
    } else {
      console.log("[CONTACT] Confirmation email sent successfully:", confirmationEmailResult.data?.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Message envoyé avec succès ! Nous vous répondrons sous 24-48h." 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("[CONTACT] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Une erreur est survenue lors de l'envoi du message" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
