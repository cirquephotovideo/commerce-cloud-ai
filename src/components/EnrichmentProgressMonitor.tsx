import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, Clock, Zap, Image, FileText, Tag, Video, ShoppingCart, TrendingUp, PlayCircle, AlertTriangle, Trash2, RotateCcw, Brain } from 'lucide-react';
import { ProviderSelector } from './admin/ProviderSelector';
import { useAIProvider } from '@/hooks/useAIProvider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

// Coûts estimés par type d'enrichissement (en €)
const ENRICHMENT_COSTS: Record<string, number> = {
  'amazon': 0.05,           // Appel API Amazon + parsing
  'images': 0.08,           // Génération d'images IA
  'ai_images': 0.08,        // Images IA
  'image_search': 0.03,     // Recherche d'images
  'competitor_analysis': 0.10, // Analyse concurrentielle
  'seo': 0.04,             // Optimisation SEO
  'taxonomy': 0.02,        // Catégorisation
  'heygen': 0.25,          // Génération vidéo (coûteux)
  'specifications': 0.06,  // Spécifications techniques
  'cost_analysis': 0.07,   // Analyse des coûts
  'technical_description': 0.05, // Description technique
  'basic': 0.02,           // Analyse de base
  'default': 0.03          // Coût par défaut
};

export function EnrichmentProgressMonitor() {
  const [tasks, setTasks] = useState<EnrichmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [forceProcessing, setForceProcessing] = useState(false);
  const [progressTick, setProgressTick] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  // AI Provider management
  const { provider: currentProvider, updateProvider, fallbackEnabled, updateFallback } = useAIProvider();

  // Force le recalcul de la progression toutes les secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setProgressTick(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Polling léger si des tâches sont en processing
  useEffect(() => {
    const processingTasks = tasks.filter(t => t.status === 'processing');
    
    if (processingTasks.length > 0) {
      const pollingInterval = setInterval(() => {
        console.log('[ENRICHMENT-MONITOR] Polling for processing tasks updates');
        loadTasks();
      }, 10000); // 10 secondes

      return () => clearInterval(pollingInterval);
    }
  }, [tasks]);

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
          setIsUpdating(true);
          loadTasks();
          setTimeout(() => setIsUpdating(false), 500); // Animation de 500ms
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
      if (!user) {
        console.error('[ENRICHMENT-MONITOR] ❌ No user authenticated');
        return;
      }

      console.log('[ENRICHMENT-MONITOR] 👤 Loading tasks for user:', user.id);

      // Get all tasks from last 24h
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('enrichment_queue')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ENRICHMENT-MONITOR] ❌ Error loading tasks:', error);
        throw error;
      }

      console.log(`[ENRICHMENT-MONITOR] ✅ Loaded ${data?.length || 0} tasks:`, data);
      setTasks(data || []);
    } catch (error) {
      console.error('[ENRICHMENT-MONITOR] ❌ Fatal error:', error);
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
      const startTime = task.started_at 
        ? new Date(task.started_at).getTime() 
        : new Date(task.created_at).getTime();
      const elapsed = Date.now() - startTime;
      
      // Durées estimées selon le type d'enrichissement
      const estimatedDuration = task.enrichment_type.includes('heygen') ? 120000 : // 2 min pour vidéo
                               task.enrichment_type.includes('amazon') ? 60000 : // 1 min pour Amazon
                               task.enrichment_type.includes('images') || task.enrichment_type.includes('ai_images') ? 45000 : // 45s pour images
                               30000; // 30s par défaut
      
      // Progression logarithmique (ralentit à l'approche de 95%)
      const rawProgress = (elapsed / estimatedDuration) * 100;
      const smoothProgress = rawProgress < 50 
        ? rawProgress 
        : 50 + (45 * Math.log(rawProgress - 49) / Math.log(51));
      
      return Math.min(95, Math.floor(smoothProgress));
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

  // Calculer le coût total des enrichissements
  const getCostStats = () => {
    const calculateTaskCost = (task: EnrichmentTask) => {
      // Vérifier si la tâche utilise Ollama (gratuit)
      const metadata = task as any;
      if (metadata.metadata?.provider === 'ollama' || 
          metadata.metadata?.provider === 'ollama_cloud' ||
          metadata.metadata?.provider === 'ollama_local') {
        return 0; // Ollama est GRATUIT
      }
      
      return task.enrichment_type.reduce((total, type) => {
        return total + (ENRICHMENT_COSTS[type] || ENRICHMENT_COSTS.default);
      }, 0);
    };

    const totalCost = tasks.reduce((sum, task) => sum + calculateTaskCost(task), 0);
    const completedCost = tasks
      .filter(t => t.status === 'completed')
      .reduce((sum, task) => sum + calculateTaskCost(task), 0);
    const processingCost = tasks
      .filter(t => t.status === 'processing')
      .reduce((sum, task) => sum + calculateTaskCost(task), 0);
    const pendingCost = tasks
      .filter(t => t.status === 'pending')
      .reduce((sum, task) => sum + calculateTaskCost(task), 0);

    // Compter les tâches Ollama séparément
    const ollamaTasks = tasks.filter(t => {
      const metadata = t as any;
      return metadata.metadata?.provider === 'ollama' || 
             metadata.metadata?.provider === 'ollama_cloud' ||
             metadata.metadata?.provider === 'ollama_local';
    });

    return {
      total: totalCost,
      completed: completedCost,
      processing: processingCost,
      pending: pendingCost,
      failed: totalCost - completedCost - processingCost - pendingCost,
      ollama_count: ollamaTasks.length
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
  const deleteTask = async (taskId: string, taskStatus: string) => {
    // Confirmation obligatoire pour les tâches en cours
    if (taskStatus === 'processing') {
      if (!confirm('⚠️ Cette tâche est en cours. Voulez-vous vraiment la supprimer ?')) {
        return;
      }
    }
    
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

  // Supprimer toutes les tâches (tous statuts)
  const deleteAllTasks = async () => {
    if (!confirm(`⚠️ Voulez-vous vraiment supprimer TOUTES les ${tasks.length} tâches ?\n\nCeci inclut :\n- ${stats.pending} tâche(s) en attente\n- ${stats.processing} tâche(s) en cours\n- ${stats.completed} tâche(s) terminée(s)\n- ${stats.failed} tâche(s) échouée(s)\n\nCette action est irréversible.`)) {
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('enrichment_queue')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      toast.success(`✅ ${tasks.length} tâche(s) supprimée(s)`);
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

  // Handlers pour la sélection du provider
  const handleProviderChange = async (newProvider: any) => {
    await updateProvider(newProvider);
  };

  const handleFallbackToggle = async (enabled: boolean) => {
    await updateFallback(enabled);
  };

  const handleConfigureProvider = (provider: any) => {
    toast.info(`Configuration de ${provider} disponible dans l'Admin`);
  };

  const stats = getStats();
  const costStats = getCostStats();
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
          <Badge variant="outline" className="text-xs">
            {tasks.length} tâches chargées
          </Badge>
          {isUpdating && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 animate-pulse text-sm px-2 py-1">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Mise à jour...
            </Badge>
          )}
        </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${queueStatus.color} border`}>
              <queueStatus.icon className="h-3 w-3 mr-1" />
              {queueStatus.label}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                console.log('[ENRICHMENT-MONITOR] 🔄 Manual refresh triggered');
                loadTasks();
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Rafraîchir
            </Button>
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
            {tasks.length > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={deleteAllTasks}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Tout Supprimer ({tasks.length})
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
      <CardContent className="space-y-6">
        {/* Banner d'alerte proéminent pour les enrichissements en cours */}
        {stats.processing > 0 && (
          <Alert className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-500/50 animate-pulse">
            <AlertTitle className="flex items-center gap-3 text-xl font-bold">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="text-blue-600">
                {stats.processing} enrichissement{stats.processing > 1 ? 's' : ''} en cours...
              </span>
            </AlertTitle>
            <AlertDescription className="text-base mt-2">
              <div className="flex flex-wrap gap-2">
                {tasks
                  .filter(t => t.status === 'processing')
                  .map(t => t.enrichment_type)
                  .flat()
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map(type => (
                    <Badge key={type} variant="secondary" className="text-sm">
                      {ENRICHMENT_LABELS[type] || type}
                    </Badge>
                  ))
                }
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Progression globale améliorée */}
        {stats.processing > 0 && (
          <div className="p-5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border-2 border-blue-500/40 shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600 animate-pulse" />
                  Progression Globale
                </span>
                <span className="text-3xl font-black text-blue-600">
                  {Math.floor((stats.completed / stats.total) * 100)}%
                </span>
              </div>
              
              <Progress 
                value={(stats.completed / stats.total) * 100} 
                className="h-4"
              />
              
              {/* Temps et coût restant */}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-blue-500/20">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    <Clock className="h-4 w-4 inline mr-1" />
                    Temps restant: <span className="font-semibold">~{Math.ceil(stats.processing * 1.5)}min</span>
                  </span>
                </div>
                <span className="text-purple-600 font-bold">
                  💰 En cours: {costStats.processing.toFixed(2)}€
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stats globales avec coûts */}
        <div className="space-y-4">
          {/* Ligne 1: Stats de tâches */}
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

          {/* Ligne 2: Stats de coûts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-2 border-purple-500/20">
              <div className="text-xl font-bold text-purple-600">
                {costStats.total.toFixed(2)}€
                {costStats.ollama_count > 0 && (
                  <span className="text-xs text-green-600 ml-2">
                    +{costStats.ollama_count} gratuits
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground font-semibold">Coût Total</div>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-xl font-bold text-blue-600">{costStats.processing.toFixed(2)}€</div>
              <div className="text-xs text-muted-foreground">En cours</div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xl font-bold text-green-600">{costStats.completed.toFixed(2)}€</div>
              <div className="text-xs text-muted-foreground">Terminés</div>
            </div>
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="text-xl font-bold text-yellow-600">{costStats.pending.toFixed(2)}€</div>
              <div className="text-xs text-muted-foreground">En attente</div>
            </div>
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
                    className={`p-4 rounded-lg border bg-card hover:shadow-md transition-shadow ${
                      task.status === 'processing' ? 'ring-2 ring-blue-500/50 animate-pulse' : ''
                    }`}
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
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`${getStatusColor(task.status)} border flex items-center gap-1 ${
                                task.status === 'processing' ? 'text-base px-3 py-1 animate-pulse font-bold' : ''
                              }`}
                            >
                              {getStatusIcon(task.status)}
                              {task.status === 'completed' && 'Terminé'}
                              {task.status === 'processing' && '⚡ En cours'}
                              {task.status === 'failed' && 'Échoué'}
                              {task.status === 'pending' && 'En attente'}
                            </Badge>
                            
                            {/* Bouton de suppression pour TOUTES les tâches */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteTask(task.id, task.status)}
                              className="text-red-600 hover:bg-red-50 opacity-50 hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                                onClick={() => deleteTask(task.id, task.status)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Metadata avec coût */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
                          
                          {/* Coût de la tâche */}
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                            💰 {task.enrichment_type.reduce((total, type) => 
                              total + (ENRICHMENT_COSTS[type] || ENRICHMENT_COSTS.default), 0
                            ).toFixed(2)}€
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

        {/* Section Résultats d'Enrichissement */}
        {stats.completed > 0 && (
          <div className="mt-6 space-y-4 pt-6 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Résultats des Enrichissements ({stats.completed})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTasks}
              >
                <Zap className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground mb-4">
              Les produits ont été enrichis avec succès. Consultez les fiches produits pour voir les détails.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks
                .filter(t => t.status === 'completed')
                .slice(0, 9)
                .map((task) => {
                  const Icon = ENRICHMENT_ICONS[task.enrichment_type[0]] || ENRICHMENT_ICONS.default;
                  
                  return (
                    <Card 
                      key={task.id} 
                      className="hover:shadow-xl transition-all cursor-pointer border-2 border-green-500/30 bg-green-50/50 dark:bg-green-950/20 hover:border-green-500/60 hover:scale-[1.02]"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center ring-2 ring-green-500/30">
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">
                              Enrichissement Réussi
                            </h4>
                          </div>
                          <Badge className="bg-green-600 text-white hover:bg-green-700">
                            ✓ Succès
                          </Badge>
                        </div>
                        
                        <div className="space-y-1.5 bg-white/50 dark:bg-gray-900/50 p-3 rounded-lg">
                          {task.enrichment_type.slice(0, 3).map(type => {
                            const TypeIcon = ENRICHMENT_ICONS[type] || ENRICHMENT_ICONS.default;
                            return (
                              <div key={type} className="flex items-center gap-2 text-sm">
                                <TypeIcon className="h-4 w-4 text-green-600" />
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                  {ENRICHMENT_LABELS[type]}
                                </span>
                                <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto animate-pulse" />
                              </div>
                            );
                          })}
                          {task.enrichment_type.length > 3 && (
                            <div className="text-xs text-muted-foreground italic pl-6">
                              +{task.enrichment_type.length - 3} autres enrichissements...
                            </div>
                          )}
                        </div>
                        
                        {task.completed_at && (
                          <div className="flex items-center justify-between pt-2 border-t border-green-200/50">
                            <div className="text-xs text-muted-foreground">
                              ✓ Terminé {formatDistanceToNow(new Date(task.completed_at), { 
                                addSuffix: true,
                                locale: fr 
                              })}
                            </div>
                            <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300">
                              ⭐ Qualité: A+
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>

            {tasks.filter(t => t.status === 'completed').length > 9 && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={loadTasks}>
                  Voir tous les résultats ({tasks.filter(t => t.status === 'completed').length})
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Section Sélection du Provider IA */}
        <div className="mt-8 pt-6 border-t">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Provider IA pour les Enrichissements</h3>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Sélectionnez le provider IA qui sera utilisé pour les prochains enrichissements
            </p>
            
            {/* Provider Selector */}
            <ProviderSelector
              selected={currentProvider}
              onSelect={handleProviderChange}
              onConfigure={handleConfigureProvider}
            />
            
            {/* Options de fallback */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Fallback Automatique</Label>
                <p className="text-xs text-muted-foreground">
                  Basculer automatiquement vers un autre provider en cas d'erreur
                </p>
              </div>
              <Switch
                checked={fallbackEnabled}
                onCheckedChange={handleFallbackToggle}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
