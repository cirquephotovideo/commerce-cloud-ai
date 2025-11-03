import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface MCPRateLimitDisplayProps {
  platforms: any[];
}

export const MCPRateLimitDisplay = ({ platforms }: MCPRateLimitDisplayProps) => {
  const [rateLimits, setRateLimits] = useState<any[]>([]);

  useEffect(() => {
    const fetchRateLimits = async () => {
      const { data } = await supabase
        .from('mcp_rate_limits')
        .select('*')
        .order('created_at', { ascending: false });
      
      setRateLimits(data || []);
    };
    fetchRateLimits();

    const interval = setInterval(fetchRateLimits, 30000);
    return () => clearInterval(interval);
  }, []);

  const getLimitForPackage = (packageId: string) => {
    if (packageId.includes('odoo')) return 100;
    if (packageId.includes('prestashop')) return 50;
    if (packageId.includes('amazon')) return 20;
    return 50;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {platforms.map(platform => {
        const limit = getLimitForPackage(platform.platform_type);
        const current = rateLimits.find(rl => rl.package_id === platform.platform_type);
        const used = current?.call_count || 0;
        const percentage = (used / limit) * 100;

        return (
          <Card key={platform.id}>
            <CardHeader>
              <CardTitle className="text-sm">{platform.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Quota</span>
                  <span className="font-mono">{used}/{limit}</span>
                </div>
                <Progress value={percentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {limit - used} appels restants
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
