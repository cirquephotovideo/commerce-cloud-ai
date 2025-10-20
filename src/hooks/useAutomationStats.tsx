import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AutomationStats {
  category: string;
  total: number;
  active: number;
  inactive: number;
  total_triggers: number;
  total_successes: number;
  total_errors: number;
  success_rate: number;
}

export const useAutomationStats = () => {
  return useQuery({
    queryKey: ['automation-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_master_rules')
        .select('*');

      if (error) throw error;

      // Group by category and calculate stats
      const statsByCategory: Record<string, AutomationStats> = {};

      data?.forEach((rule) => {
        const category = rule.rule_category;
        
        if (!statsByCategory[category]) {
          statsByCategory[category] = {
            category,
            total: 0,
            active: 0,
            inactive: 0,
            total_triggers: 0,
            total_successes: 0,
            total_errors: 0,
            success_rate: 0,
          };
        }

        const stats = statsByCategory[category];
        stats.total++;
        
        if (rule.is_active) {
          stats.active++;
        } else {
          stats.inactive++;
        }

        stats.total_triggers += rule.trigger_count || 0;
        stats.total_successes += rule.success_count || 0;
        stats.total_errors += rule.error_count || 0;
      });

      // Calculate success rates
      Object.values(statsByCategory).forEach((stats) => {
        if (stats.total_triggers > 0) {
          stats.success_rate = Math.round((stats.total_successes / stats.total_triggers) * 100);
        }
      });

      // Calculate global stats
      const globalStats = {
        total_rules: data?.length || 0,
        active_rules: data?.filter(r => r.is_active).length || 0,
        total_triggers: data?.reduce((sum, r) => sum + (r.trigger_count || 0), 0) || 0,
        total_successes: data?.reduce((sum, r) => sum + (r.success_count || 0), 0) || 0,
        total_errors: data?.reduce((sum, r) => sum + (r.error_count || 0), 0) || 0,
      };

      return {
        byCategory: Object.values(statsByCategory),
        global: globalStats,
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
