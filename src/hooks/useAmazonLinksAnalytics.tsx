import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AmazonLinksAnalyticsData {
  date: string;
  links_created: number;
  automatic_count: number;
  manual_count: number;
  cumulative: number;
}

export function useAmazonLinksAnalytics(period: 'today' | 'week' | 'month' | 'all' = 'all') {
  return useQuery({
    queryKey: ['amazon-links-analytics', period],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .rpc('get_amazon_links_analytics', {
          p_user_id: user.id,
          p_period: period
        });
      
      if (error) throw error;

      // Process data to add cumulative count
      let cumulative = 0;
      const processedData: AmazonLinksAnalyticsData[] = (data || []).reverse().map((item: any) => {
        cumulative += Number(item.links_created);
        return {
          date: item.date,
          links_created: Number(item.links_created),
          automatic_count: Number(item.automatic_count),
          manual_count: Number(item.manual_count),
          cumulative
        };
      });

      return processedData.reverse();
    },
    staleTime: 30000, // 30 seconds
  });
}
