import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    console.log('[AUTO-PROCESS] Starting automatic email processing');

    // Récupérer les emails en attente
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_inbox')
      .select('*')
      .eq('status', 'pending')
      .not('attachment_name', 'is', null)
      .order('received_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch pending emails: ${fetchError.message}`);
    }

    console.log(`[AUTO-PROCESS] Found ${pendingEmails?.length || 0} pending emails`);

    const results = [];

    for (const email of pendingEmails || []) {
      try {
        console.log(`[AUTO-PROCESS] Processing email ${email.id} from ${email.from_email}`);

        // Invoquer process-email-attachment
        const { data, error: processError } = await supabase.functions.invoke(
          'process-email-attachment',
          {
            body: {
              inbox_id: email.id,
              user_id: email.user_id
            }
          }
        );

        if (processError) {
          console.error(`[AUTO-PROCESS] Error processing ${email.id}:`, processError);
          results.push({
            email_id: email.id,
            status: 'error',
            error: processError.message
          });
        } else {
          console.log(`[AUTO-PROCESS] Successfully processed ${email.id}`);
          results.push({
            email_id: email.id,
            status: 'success',
            ...data
          });
        }

        // Attendre 2 secondes entre chaque traitement
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`[AUTO-PROCESS] Exception processing ${email.id}:`, error);
        results.push({
          email_id: email.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`[AUTO-PROCESS] Completed processing ${results.length} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUTO-PROCESS] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
