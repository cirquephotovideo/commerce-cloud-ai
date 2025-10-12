import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Video, AlertCircle, ExternalLink, Download, X, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VideoHistoryDialog } from "./VideoHistoryDialog";

interface VideoPlayerProps {
  analysisId: string;
  showCard?: boolean;
}

export const VideoPlayer = ({ analysisId, showCard = true }: VideoPlayerProps) => {
  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchLatestVideo();
  }, [analysisId]);

  // Auto-récupération pour les vidéos en timeout
  useEffect(() => {
    const autoRecoverIfNeeded = async () => {
      if (video?.status === 'failed' && 
          video?.error_message?.includes('Timeout') && 
          video?.video_id) {
        console.log('[VideoPlayer] Auto-recovery for timeout video:', video.video_id);
        toast.info("🔄 Récupération automatique de la vidéo...");
        
        try {
          const { data, error: checkError } = await supabase.functions.invoke('heygen-video-generator', {
            body: { 
              action: 'check_status',
              analysis_id: analysisId,
              video_id: video.video_id,
              force_recovery: true
            }
          });
          
          if (!checkError && data?.status === 'completed' && data?.video_url) {
            // Mise à jour optimiste immédiate
            setVideo(prev => prev ? {
              ...prev,
              status: 'completed',
              video_url: data.video_url,
              thumbnail_url: data.thumbnail_url,
              duration: data.duration,
              error_message: null,
              completed_at: new Date().toISOString()
            } : prev);
            
            toast.success("✅ Vidéo récupérée avec succès !");
            // Ne pas fetch immédiatement pour éviter que la DB stale écrase notre état optimiste
          }
        } catch (err) {
          console.error('[VideoPlayer] Auto-recovery error:', err);
        }
      }
    };
    
    autoRecoverIfNeeded();
  }, [video?.id, analysisId]);

  // Auto-polling pour les vidéos en cours de génération ou pending
  useEffect(() => {
    if (!video || !['processing', 'pending'].includes(video.status)) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data, error: statusError } = await supabase.functions.invoke('heygen-video-generator', {
          body: { 
            action: 'check_status',
            analysis_id: analysisId,
            video_id: video.video_id
          }
        });

        if (statusError) {
          console.error('[VideoPlayer] Status check error:', statusError);
          return;
        }

        // Mettre à jour la vidéo si le statut a changé
        if (data?.status && data.status !== video.status) {
          await fetchLatestVideo();
          
          // Toast uniquement si video_url est disponible
          if (data.status === 'completed' && data.video_url) {
            toast.success("✅ Vidéo disponible !");
          } else if (data.status === 'failed') {
            toast.error("❌ Erreur lors de la génération");
          }
        }
      } catch (err) {
        console.error('[VideoPlayer] Polling error:', err);
      }
    }, 5000); // Poll toutes les 5 secondes

    return () => clearInterval(pollInterval);
  }, [video?.status, analysisId]);

  // Compteur de temps écoulé depuis created_at
  useEffect(() => {
    if (!video || !['processing', 'pending'].includes(video.status)) {
      setElapsedTime(0);
      return;
    }

    const startTime = new Date(video.created_at).getTime();
    const updateElapsed = () => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);

    return () => clearInterval(timer);
  }, [video?.status, video?.created_at]);

  const fetchLatestVideo = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('product_videos')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Protection: ne pas écraser video_url local si la DB n'en a pas encore
      if (video?.video_url && data && !data.video_url) {
        console.log('[VideoPlayer] Skipping stale DB response (local has video_url, DB does not)');
        return;
      }

      setVideo(data);
    } catch (err: any) {
      console.error('[VideoPlayer] Error fetching video:', err);
      setError(err.message || 'Erreur lors du chargement de la vidéo');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">✅ Terminé</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive">❌ Erreur</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownload = () => {
    if (video?.video_url) {
      window.open(video.video_url, '_blank');
    }
  };

  const handleCancel = async () => {
    if (!video?.video_id) return;
    
    setCancelling(true);
    try {
      const { error: cancelError } = await supabase.functions.invoke('heygen-video-generator', {
        body: {
          action: 'cancel',
          analysis_id: analysisId,
          video_id: video.video_id
        }
      });

      if (cancelError) {
        toast.error("❌ Erreur lors de l'annulation");
        return;
      }

      toast.success("✅ Génération annulée");
      await fetchLatestVideo();
    } catch (err) {
      console.error('[VideoPlayer] Cancel error:', err);
      toast.error("❌ Erreur lors de l'annulation");
    } finally {
      setCancelling(false);
    }
  };

  const handleForceCheck = async (videoId?: string) => {
    toast.info("🔄 Vérification manuelle du statut...");
    
    if (videoId) {
      try {
        const { data, error: checkError } = await supabase.functions.invoke('heygen-video-generator', {
          body: { 
            action: 'check_status',
            analysis_id: analysisId,
            video_id: videoId,
            force_recovery: true
          }
        });
        
        if (!checkError && data?.status === 'completed' && data?.video_url) {
          // Mise à jour optimiste immédiate
          setVideo(prev => prev ? {
            ...prev,
            status: 'completed',
            video_url: data.video_url,
            thumbnail_url: data.thumbnail_url,
            duration: data.duration,
            error_message: null,
            completed_at: new Date().toISOString()
          } : prev);
          
          toast.success("✅ Vidéo récupérée !");
          // Ne pas fetch immédiatement pour éviter écrasement par DB stale
        }
      } catch (err) {
        console.error('[VideoPlayer] Force check error:', err);
      }
    }
    
    // Fetch retardé pour laisser le backend se synchro
    setTimeout(() => fetchLatestVideo(), 2500);
  };

  const content = (
    <>
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement de la vidéo...</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {!loading && !error && !video && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Video className="w-12 h-12 text-muted-foreground opacity-50 mb-3" />
          <p className="text-sm text-muted-foreground">Aucune vidéo générée pour ce produit</p>
          <p className="text-xs text-muted-foreground mt-1">Utilisez le bouton "Générer" dans l'onglet Actions</p>
        </div>
      )}

    {!loading && !error && video && (() => {
      const hasPlayable = Boolean(video.video_url);
      const effectiveStatus = hasPlayable ? 'completed' : video.status;
      
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusBadge(effectiveStatus)}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowHistory(true)}
              >
                <History className="w-3 h-3 mr-1" />
                Historique
              </Button>
            </div>
            {hasPlayable && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="w-3 h-3 mr-1" />
                  Télécharger
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(video.video_url, '_blank')}>
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Ouvrir
                </Button>
              </div>
            )}
          </div>

          {/* PRIORITÉ ABSOLUE : Si video_url existe, afficher le lecteur */}
          {hasPlayable && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <span className="text-sm font-medium">🔗 Lien de la vidéo :</span>
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                {video.video_url}
              </code>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  navigator.clipboard.writeText(video.video_url);
                  toast.success("Lien copié !");
                }}
              >
                Copier
              </Button>
            </div>
            
            <video 
              controls 
              playsInline
              preload="metadata"
              className="w-full rounded-lg border-2 border-border shadow-lg"
              src={video.video_url}
              poster={video.thumbnail_url || undefined}
              controlsList="nodownload"
            >
              Votre navigateur ne supporte pas la lecture vidéo.
            </video>
            
            {video.duration && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Durée : {Math.round(video.duration)}s</span>
                <span>Généré le {new Date(video.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            )}
            </div>
          )}

          {/* Si pas de video_url mais processing, afficher spinner */}
          {!hasPlayable && video.status === 'processing' && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">⏳ Génération en cours chez HeyGen...</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="h-full bg-primary/60 animate-pulse" style={{ width: '60%' }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>La génération peut prendre 1 à 3 minutes. Le statut se met à jour automatiquement.</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <X className="w-3 h-3 mr-1" />
                      Annuler
                    </>
                  )}
                </Button>
              </div>
              
              {/* ✅ AJOUT: Avertissement timeout après 5 minutes */}
              {elapsedTime > 300 && (
                <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                      ⚠️ Génération anormalement longue
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      La génération prend plus de temps que prévu. Vous pouvez forcer une vérification.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleForceCheck(video.video_id)}>
                    Vérifier
                  </Button>
                </div>
              )}
              </div>
            )}

          {/* Si pas de video_url et failed, afficher erreur */}
          {!hasPlayable && video.status === 'failed' && (
            <>
              {/* Si c'est un timeout, afficher message optimiste */}
              {video.error_message?.includes('Timeout') ? (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                      ⏳ Récupération de la vidéo en cours...
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La génération a pris plus de temps que prévu. Tentative de récupération automatique...
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleForceCheck(video.video_id)}
                  >
                    Forcer la vérification
                  </Button>
                </div>
              ) : (
                /* Affichage normal pour les vraies erreurs */
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">Erreur de génération</span>
                  </div>
                  {video.error_message && (
                    <p className="text-xs text-destructive/80">{video.error_message}</p>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleForceCheck(video.video_id)}
                    >
                      Vérifier si la vidéo est prête
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        const actionsTab = document.querySelector('[data-value="actions"]') as HTMLElement;
                        if (actionsTab) actionsTab.click();
                        toast.info("Veuillez régénérer la vidéo depuis l'onglet Actions");
                      }}
                    >
                      Régénérer la vidéo
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      );
    })()}

    <VideoHistoryDialog
      analysisId={analysisId}
      open={showHistory}
      onOpenChange={setShowHistory}
    />
    </>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5" />
          Vidéo Promotionnelle HeyGen
        </CardTitle>
        <CardDescription>
          Vidéo générée avec un avatar IA pour présenter le produit
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};
