import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Clock, Zap, Image, FileText, Tag, Video, ShoppingCart, TrendingUp, PlayCircle, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface EnrichmentTask {
  id: string;
  analysis_id: string | null;
  supplier_product_id: string | null;
  enrichment_type: string[];
  status: string;
  priority: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

const ENRICHMENT_ICONS: Record<string, any> = {
  'amazon': ShoppingCart,
  'images': Image,
  'ai_images': Image,
  'image_search': Image,
  'competitor_analysis': TrendingUp,
  'seo': FileText,
  'taxonomy': Tag,
  'heygen': Video,
  'specifications': FileText,
  'cost_analysis': TrendingUp,
  'technical_description': FileText,
  'default': Zap
};

const ENRICHMENT_LABELS: Record<string, string> = {
  'amazon': 'Données Amazon',
  'images': 'Images IA',
  'ai_images': 'Images IA',
  'image_search': 'Recherche Images',
  'competitor_analysis': 'Analyse Concurrence',
  'seo': 'Optimisation SEO',
  'taxonomy': 'Catégorisation',
  'heygen': 'Génération Vidéo',
  'specifications': 'Spécifications',
  'cost_analysis': 'Analyse Coûts',
  'technical_description': 'Description Technique',
  'default': 'Enrichissement'
};

export function EnrichmentProgressMonitor() {
  const [tasks, setTasks] = useState<EnrichmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [forceProcessing, setForceProcessing] = useState(false);

  useEffect(() => {
    loadTasks();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('enrichment-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_queue'
        },
        (payload) => {
          console.log('[ENRICHMENT-MONITOR] Realtime update:', payload);
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all tasks from last 24h
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('enrichment_queue')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('[ENRICHMENT-MONITOR] Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'processing': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'failed': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const calculateProgress = (task: EnrichmentTask) => {
    if (task.status === 'completed') return 100;
    if (task.status === 'failed') return 0;
    if (task.status === 'processing') {
      // Estimate progress based on time elapsed
      const startTime = task.started_at ? new Date(task.started_at).getTime() : new Date(task.created_at).getTime();
      const elapsed = Date.now() - startTime;
      const estimatedDuration = 30000; // 30 seconds estimate
      return Math.min(95, Math.floor((elapsed / estimatedDuration) * 100));
    }
    return 0;
  };

  const getStats = () => {
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    };
  };

  // Déterminer l'état de la queue
  const getQueueStatus = () => {
    const now = Date.now();
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    
    if (pendingTasks.length === 0) return { status: 'idle', color: 'bg-muted', icon: CheckCircle2, label: 'Aucune tâche' };
    
    // Queue bloquée si tasks > 30 min en pending
    const blockedTasks = pendingTasks.filter(t => {
      const createdAt = new Date(t.created_at).getTime();
      return (now - createdAt) > 30 * 60 * 1000; // 30 minutes
    });
    
    if (blockedTasks.length > 0) {
      return { status: 'blocked', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: AlertTriangle, label: '⚠️ Queue bloquée' };
    }
    
    // Queue lente si aucune task traitée depuis 10 min
    const processingOrCompleted = tasks.filter(t => t.status === 'processing' || (t.status === 'completed' && t.completed_at));
    const recentActivity = processingOrCompleted.some(t => {
      const timestamp = t.completed_at || t.started_at;
      if (!timestamp) return false;
      return (now - new Date(timestamp).getTime()) < 10 * 60 * 1000; // 10 minutes
    });
    
    if (!recentActivity && pendingTasks.length > 0) {
      return { status: 'slow', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock, label: '🟡 Queue lente' };
    }
    
    return { status: 'active', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: Zap, label: '🟢 Queue active' };
  };

  // Forcer le traitement
  const handleForceProcessing = async () => {
    setForceProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-enrichment-queue', {
        body: { maxItems: 10 }
      });
      
      if (error) throw error;
      
      toast.success(`✅ Traitement forcé: ${data.processed} tâches traitées`);
      loadTasks();
    } catch (error: any) {
      console.error('[ENRICHMENT-MONITOR] Error forcing processing:', error);
      toast.error(`❌ Erreur: ${error.message}`);
    } finally {
      setForceProcessing(false);
    }
  };

  // Supprimer une tâche
  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('enrichment_queue')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
      toast.success('✅ Tâche supprimée');
      loadTasks();
    } catch (error: any) {
      toast.error(`❌ Erreur: ${error.message}`);
    }
  };

  // Nettoyer toutes les tâches échouées
  const cleanFailedTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('enrichment_queue')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'failed');
      
      if (error) throw error;
      toast.success('✅ Tâches échouées supprimées');
      loadTasks();
    } catch (error: any) {
      toast.error(`❌ Erreur: ${error.message}`);
    }
  };

  // Réessayer une tâche échouée
  const retryTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('enrichment_queue')
        .update({ 
          status: 'pending', 
          error_message: null,
          retry_count: 0,
          started_at: null,
          completed_at: null
        })
        .eq('id', taskId);
      
      if (error) throw error;
      
      // Forcer le traitement
      await supabase.functions.invoke('process-enrichment-queue');
      
      toast.success('✅ Tâche remise en queue');
      loadTasks();
    } catch (error: any) {
      toast.error(`❌ Erreur: ${error.message}`);
    }
  };

  const stats = getStats();
  const queueStatus = getQueueStatus();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Progression des Enrichissements
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${queueStatus.color} border`}>
              <queueStatus.icon className="h-3 w-3 mr-1" />
              {queueStatus.label}
            </Badge>
            {stats.failed > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={cleanFailedTasks}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Nettoyer les échecs ({stats.failed})
              </Button>
            )}
            {stats.pending > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleForceProcessing}
                disabled={forceProcessing}
              >
                {forceProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Forcer le traitement
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats globales */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">En attente</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
            <div className="text-xs text-muted-foreground">En cours</div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Terminés</div>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Échoués</div>
          </div>
        </div>

        {/* Liste des tâches */}
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Aucun enrichissement récent</p>
                <p className="text-sm mt-1">Les enrichissements des dernières 24h s'afficheront ici</p>
              </div>
            ) : (
              tasks.map((task) => {
                const progress = calculateProgress(task);
                const Icon = ENRICHMENT_ICONS[task.enrichment_type[0]] || ENRICHMENT_ICONS.default;
                
                return (
                  <div 
                    key={task.id}
                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate">
                            {task.enrichment_type.map(type => 
                              ENRICHMENT_LABELS[type] || type
                            ).join(', ')}
                          </div>
                          <Badge variant="outline" className={`${getStatusColor(task.status)} border flex items-center gap-1`}>
                            {getStatusIcon(task.status)}
                            {task.status === 'completed' && 'Terminé'}
                            {task.status === 'processing' && 'En cours'}
                            {task.status === 'failed' && 'Échoué'}
                            {task.status === 'pending' && 'En attente'}
                          </Badge>
                        </div>

                        {/* Progress bar */}
                        {(task.status === 'processing' || task.status === 'pending') && (
                          <div className="space-y-1">
                            <Progress value={progress} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {progress}% complété
                            </div>
                          </div>
                        )}

                        {/* Error message */}
                        {task.error_message && (
                          <div className="space-y-2">
                            <div className="text-xs text-red-600 bg-red-500/10 p-2 rounded border border-red-500/20 break-words">
                              {task.error_message.length > 150 
                                ? task.error_message.substring(0, 150) + '...' 
                                : task.error_message}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => retryTask(task.id)}
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Réessayer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTask(task.id)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            Créé {formatDistanceToNow(new Date(task.created_at), { 
                              addSuffix: true,
                              locale: fr 
                            })}
                          </span>
                          {task.completed_at && (
                            <span>
                              • Terminé {formatDistanceToNow(new Date(task.completed_at), { 
                                addSuffix: true,
                                locale: fr 
                              })}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {task.priority === 'high' ? 'Haute' : 
                             task.priority === 'low' ? 'Basse' : 'Normale'} priorité
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
