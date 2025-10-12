import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    console.log('[CRON] Checking enrichment queue health...');

    // Vérifier les tâches bloquées
    const { data: queue, error } = await supabase
      .from('enrichment_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching queue:', error);
      throw error;
    }

    const failedTasks = queue?.filter(e => e.status === 'failed') || [];
    const pendingTasks = queue?.filter(e => e.status === 'pending') || [];
    const processingTasks = queue?.filter(e => e.status === 'processing') || [];

    // Détecter les tâches "processing" bloquées (>1h)
    const stuckTasks = processingTasks.filter(task => {
      if (!task.started_at) return false;
      const hoursSinceStart = (Date.now() - new Date(task.started_at).getTime()) / (1000 * 60 * 60);
      return hoursSinceStart > 1;
    });

    console.log(`Failed: ${failedTasks.length}, Pending: ${pendingTasks.length}, Stuck: ${stuckTasks.length}`);

    // Alerter si trop de tâches échouées ou bloquées
    let shouldAlert = false;
    let alertLevel: 'warning' | 'critical' = 'warning';
    let alertMessage = '';

    if (failedTasks.length > 20) {
      shouldAlert = true;
      alertLevel = 'critical';
      alertMessage = `🚨 ${failedTasks.length} tâches d'enrichissement échouées ! Intervention requise.`;
    } else if (failedTasks.length > 10) {
      shouldAlert = true;
      alertLevel = 'warning';
      alertMessage = `⚠️ ${failedTasks.length} tâches d'enrichissement échouées.`;
    } else if (stuckTasks.length > 5) {
      shouldAlert = true;
      alertLevel = 'warning';
      alertMessage = `⚠️ ${stuckTasks.length} tâches d'enrichissement bloquées depuis >1h.`;
    }

    // Réinitialiser les tâches bloquées automatiquement
    if (stuckTasks.length > 0) {
      console.log(`Resetting ${stuckTasks.length} stuck tasks...`);
      await supabase
        .from('enrichment_queue')
        .update({ status: 'pending', started_at: null })
        .in('id', stuckTasks.map(t => t.id));
    }

    if (shouldAlert) {
      console.log(`Sending alert: ${alertMessage}`);

      // Créer une alerte pour tous les super admins
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      if (adminRoles) {
        for (const admin of adminRoles) {
          await supabase.from('user_alerts').insert({
            user_id: admin.user_id,
            alert_type: 'enrichment_issue',
            severity: alertLevel,
            title: 'Problème Queue Enrichissement',
            message: alertMessage,
            action_url: '/admin?tab=health',
            metadata: {
              failed_count: failedTasks.length,
              stuck_count: stuckTasks.length,
              pending_count: pendingTasks.length
            }
          });
        }
      }

      // Logger l'événement
      await supabase.from('system_health_logs').insert({
        test_type: 'enrichment_queue_check',
        component_name: 'enrichment_queue',
        status: alertLevel === 'critical' ? 'failing' : 'warning',
        test_result: {
          failed: failedTasks.length,
          pending: pendingTasks.length,
          stuck: stuckTasks.length
        },
        error_message: alertLevel === 'critical' ? alertMessage : null
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        failed: failedTasks.length,
        stuck: stuckTasks.length,
        pending: pendingTasks.length,
        alert_sent: shouldAlert,
        alert_level: shouldAlert ? alertLevel : null,
        stuck_tasks_reset: stuckTasks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-enrichment-queue-stuck:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});