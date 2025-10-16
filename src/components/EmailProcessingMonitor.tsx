import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";

export function EmailProcessingMonitor() {
  const [realtimeStats, setRealtimeStats] = useState({
    processing: 0,
    completed: 0,
    failed: 0,
    pending: 0
  });

  // Stats globales
  const { data: stats } = useQuery({
    queryKey: ['email-processing-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_inbox')
        .select('status, created_at');
      
      if (error) throw error;

      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      const statusCounts = {
        total: data?.length || 0,
        processing: data?.filter(e => e.status === 'processing').length || 0,
        completed: data?.filter(e => e.status === 'completed').length || 0,
        failed: data?.filter(e => e.status === 'failed').length || 0,
        pending: data?.filter(e => e.status === 'pending').length || 0,
        lastHour: data?.filter(e => now - new Date(e.created_at).getTime() < oneHour).length || 0
      };

      return statusCounts;
    },
    refetchInterval: 10000
  });

  // Stats par fournisseur
  const { data: supplierStats } = useQuery({
    queryKey: ['supplier-processing-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_inbox')
        .select('detected_supplier_name, status, processing_logs');
      
      if (error) throw error;

      const bySupplier: Record<string, any> = {};
      
      data?.forEach(email => {
        const supplier = email.detected_supplier_name || 'Inconnu';
        if (!bySupplier[supplier]) {
          bySupplier[supplier] = {
            name: supplier,
            total: 0,
            completed: 0,
            failed: 0,
            pending: 0,
            avgProcessingTime: 0,
            processingTimes: []
          };
        }
        
        bySupplier[supplier].total++;
        bySupplier[supplier][email.status]++;
        
        // Calculer temps de traitement
        if (email.status === 'completed' && email.processing_logs) {
          const logs = email.processing_logs as any[];
          if (logs.length >= 2) {
            const start = new Date(logs[0].timestamp).getTime();
            const end = new Date(logs[logs.length - 1].timestamp).getTime();
            bySupplier[supplier].processingTimes.push((end - start) / 1000);
          }
        }
      });

      // Calculer moyennes
      Object.values(bySupplier).forEach((s: any) => {
        if (s.processingTimes.length > 0) {
          s.avgProcessingTime = Math.round(
            s.processingTimes.reduce((a: number, b: number) => a + b, 0) / s.processingTimes.length
          );
        }
      });

      return Object.values(bySupplier);
    },
    refetchInterval: 15000
  });

  // Temps réel
  useEffect(() => {
    const channel = supabase
      .channel('processing-monitor')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_inbox'
        },
        (payload) => {
          const email = payload.new as any;
          setRealtimeStats(prev => ({
            ...prev,
            [email.status]: prev[email.status] + (payload.eventType === 'INSERT' ? 1 : 0)
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const successRate = stats ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Vue d'ensemble */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En traitement</p>
                <p className="text-2xl font-bold">{stats?.processing || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Réussis</p>
                <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Échoués</p>
                <p className="text-2xl font-bold text-red-600">{stats?.failed || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taux de succès */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taux de succès
          </CardTitle>
          <CardDescription>Performance globale du traitement des emails</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Taux de réussite</span>
              <span className="font-bold">{successRate}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {stats?.completed || 0} emails traités avec succès sur {stats?.total || 0} au total
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats par fournisseur */}
      <Card>
        <CardHeader>
          <CardTitle>Files d'attente par fournisseur</CardTitle>
          <CardDescription>Performance et statistiques détaillées</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {supplierStats?.map((supplier: any) => (
              <div key={supplier.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{supplier.name}</h4>
                  <Badge variant="outline">{supplier.total} emails</Badge>
                </div>
                
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Réussis</p>
                    <p className="font-bold text-green-600">{supplier.completed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Échoués</p>
                    <p className="font-bold text-red-600">{supplier.failed}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">En attente</p>
                    <p className="font-bold text-orange-600">{supplier.pending}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Temps moyen</p>
                    <p className="font-bold">{supplier.avgProcessingTime}s</p>
                  </div>
                </div>
                
                <Progress 
                  value={(supplier.completed / supplier.total) * 100} 
                  className="h-1 mt-3" 
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}