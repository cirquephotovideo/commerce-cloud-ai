import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface FixItem {
  id: string;
  issue_id: string;
  issue_type: string;
  component_name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  lovable_prompt: string;
  detected_at: string;
  fix_applied_at: string | null;
  retest_result: string | null;
  status: string;
  fix_duration_minutes: number | null;
}

export const FixHistoryDashboard = () => {
  const [fixes, setFixes] = useState<FixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadFixes();
  }, [filter]);

  const loadFixes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fix_tracking')
        .select('*')
        .order('detected_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFixes(data || []);
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "📋 Prompt copié",
      description: "Collez-le dans l'éditeur Lovable",
    });
  };

  const markAsResolved = async (id: string) => {
    const fix = fixes.find(f => f.id === id);
    if (!fix) return;

    const detectedTime = new Date(fix.detected_at).getTime();
    const nowTime = Date.now();
    const durationMinutes = Math.round((nowTime - detectedTime) / 60000);

    const { error } = await supabase
      .from('fix_tracking')
      .update({
        status: 'resolved',
        fix_applied_at: new Date().toISOString(),
        fix_duration_minutes: durationMinutes,
        retest_result: 'success'
      })
      .eq('id', id);

    if (!error) {
      setFixes(prev => prev.map(f => 
        f.id === id 
          ? { ...f, status: 'resolved', fix_applied_at: new Date().toISOString(), fix_duration_minutes: durationMinutes }
          : f
      ));
      
      toast({
        title: "✅ Issue résolue",
        description: `Corrigé en ${durationMinutes} minutes`,
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'destructive',
      high: 'secondary',
      medium: 'outline',
      low: 'default'
    };
    return colors[severity] || 'default';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const stats = {
    total: fixes.length,
    open: fixes.filter(f => f.status === 'open').length,
    resolved: fixes.filter(f => f.status === 'resolved').length,
    avgDuration: fixes.filter(f => f.fix_duration_minutes).reduce((acc, f) => acc + (f.fix_duration_minutes || 0), 0) / fixes.filter(f => f.fix_duration_minutes).length || 0
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ouvertes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Résolues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Temps Moyen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.avgDuration)}min</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
        >
          Toutes
        </Button>
        <Button 
          variant={filter === 'open' ? 'default' : 'outline'}
          onClick={() => setFilter('open')}
        >
          Ouvertes
        </Button>
        <Button 
          variant={filter === 'resolved' ? 'default' : 'outline'}
          onClick={() => setFilter('resolved')}
        >
          Résolues
        </Button>
      </div>

      {/* Fix History List */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground">Chargement...</p>
        ) : fixes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Aucune issue à afficher
            </CardContent>
          </Card>
        ) : (
          fixes.map((fix) => (
            <Card key={fix.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(fix.status)}
                      <CardTitle className="text-lg">{fix.component_name}</CardTitle>
                      <Badge variant={getSeverityColor(fix.severity) as any}>
                        {fix.severity}
                      </Badge>
                      <Badge variant="outline">{fix.issue_type}</Badge>
                    </div>
                    <CardDescription>{fix.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Détecté: {format(new Date(fix.detected_at), 'PPp', { locale: fr })}
                    </span>
                    {fix.fix_applied_at && (
                      <>
                        <span>•</span>
                        <span>
                          Résolu: {format(new Date(fix.fix_applied_at), 'PPp', { locale: fr })}
                        </span>
                        <span>•</span>
                        <span className="text-green-600 font-medium">
                          {fix.fix_duration_minutes}min
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyPrompt(fix.lovable_prompt)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copier Prompt
                    </Button>

                    {fix.status === 'open' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => markAsResolved(fix.id)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Marquer comme Résolu
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};