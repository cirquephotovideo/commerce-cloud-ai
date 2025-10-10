import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      userId, 
      alertType, 
      severity, 
      title, 
      message, 
      relatedProductId, 
      relatedSupplierId,
      actionUrl,
      metadata,
      sendEmail 
    } = await req.json();

    if (!userId || !alertType || !title || !message) {
      throw new Error('Missing required fields');
    }

    console.log(`[SEND-ALERT] Creating alert for user ${userId}: ${title}`);

    // Insert alert into database
    const { data: alert, error: alertError } = await supabase
      .from('user_alerts')
      .insert({
        user_id: userId,
        alert_type: alertType,
        severity: severity || 'info',
        title,
        message,
        related_product_id: relatedProductId,
        related_supplier_id: relatedSupplierId,
        action_url: actionUrl,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (alertError) {
      throw new Error(`Failed to create alert: ${alertError.message}`);
    }

    // Send email notification if requested and severity is warning or critical
    if (sendEmail !== false && (severity === 'warning' || severity === 'critical')) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        
        if (user?.email) {
          const severityEmoji = severity === 'critical' ? '🚨' : '⚠️';
          
          await resend.emails.send({
            from: 'Tarifique <notifications@tarifique.app>',
            to: [user.email],
            subject: `${severityEmoji} ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">${severityEmoji} ${title}</h1>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                  <p style="font-size: 16px; color: #333; line-height: 1.6;">${message}</p>
                  ${actionUrl ? `
                    <div style="text-align: center; margin-top: 30px;">
                      <a href="${actionUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Voir les détails
                      </a>
                    </div>
                  ` : ''}
                  <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                  <p style="font-size: 12px; color: #666; text-align: center;">
                    Vous recevez cet email car une action importante nécessite votre attention sur Tarifique.
                  </p>
                </div>
              </div>
            `,
          });

          console.log(`[SEND-ALERT] Email sent to ${user.email}`);
        }
      } catch (emailError) {
        console.error('[SEND-ALERT] Failed to send email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alert_id: alert.id,
        message: 'Alert created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEND-ALERT] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
