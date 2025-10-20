import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface AutomationActivity {
  id: string;
  rule_name: string;
  rule_category: string;
  status: 'success' | 'error' | 'running';
  timestamp: string;
  message: string;
  details?: any;
}

export const useAutomationMonitoring = () => {
  // Fetch recent activity
  const { data: recentActivity, refetch: refetchActivity } = useQuery({
    queryKey: ['automation-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_master_rules')
        .select('*')
        .not('last_triggered_at', 'is', null)
        .order('last_triggered_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return data?.map((rule) => ({
        id: rule.id,
        rule_name: rule.rule_name,
        rule_category: rule.rule_category,
        status: rule.last_error_at && 
                rule.last_error_at > (rule.last_success_at || '') 
                  ? 'error' 
                  : 'success',
        timestamp: rule.last_triggered_at!,
        message: rule.last_error_message || 'Exécution réussie',
        details: rule,
      })) as AutomationActivity[];
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch currently running automations
  const { data: runningAutomations } = useQuery({
    queryKey: ['running-automations'],
    queryFn: async () => {
      // Check import jobs
      const { data: importJobs } = await supabase
        .from('import_jobs')
        .select('*')
        .in('status', ['processing', 'queued'])
        .order('created_at', { ascending: false })
        .limit(10);

      // Check enrichment queue
      const { data: enrichmentQueue } = await supabase
        .from('enrichment_queue')
        .select('*')
        .in('status', ['processing', 'pending'])
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        importJobs: importJobs || [],
        enrichmentQueue: enrichmentQueue || [],
        totalRunning: (importJobs?.length || 0) + (enrichmentQueue?.length || 0),
      };
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('automation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'automation_master_rules'
        },
        () => {
          refetchActivity();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchActivity]);

  return {
    recentActivity,
    runningAutomations,
  };
};
