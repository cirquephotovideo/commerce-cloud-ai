import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemHealthCheck {
  status: 'ok' | 'warning' | 'critical';
  timestamp: string;
  checks: {
    database: {
      status: string;
      latency: number;
      error?: string;
    };
    queue: {
      status: string;
      metrics: {
        pending: number;
        processing: number;
        completed24h: number;
        failed24h: number;
        stuck: number;
      };
      successRate: string;
    };
    amazon_credentials?: {
      status: string;
      expires_at?: string;
      days_until_expiry?: number;
      message?: string;
    };
    recent_errors: {
      status: string;
      count: number;
      timeframe: string;
    };
  };
  recommendations: string[];
  summary: {
    overall_status: string;
    queue_health: string;
    stuck_products: number;
    success_rate_24h: string;
    orphaned_products: number;
  };
}

export const useSystemHealth = () => {
  return useQuery<SystemHealthCheck>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-health-check');
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // 30s
    staleTime: 10000,
  });
};