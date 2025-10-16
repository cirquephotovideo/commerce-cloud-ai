import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Video, Loader2, AlertCircle, History, PlayCircle } from 'lucide-react';
import { HeyGenVideoWizard } from './HeyGenVideoWizard';
import { VideoPlayer } from './VideoPlayer';
import { VideoHistoryDialog } from './VideoHistoryDialog';

interface VideoSectionProps {
  analysisId: string;
  productName: string;
}

export function VideoSection({ analysisId, productName }: VideoSectionProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [videoStatus, setVideoStatus] = useState<'none' | 'processing' | 'completed' | 'failed'>('none');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Load existing video on mount
  useEffect(() => {
    loadLatestVideo();
  }, [analysisId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const loadLatestVideo = async () => {
    try {
      const { data, error } = await supabase
        .from('product_videos')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setVideoId(data.video_id);
        setVideoStatus(data.status as any);
        setErrorMessage(data.error_message);

        // Start polling if processing
        if (data.status === 'processing') {
          startPolling(data.video_id);
        }
      }
    } catch (err) {
      console.error('[VideoSection] Load error:', err);
    }
  };

  // Phase D.3: Use get-video-status for polling
  const startPolling = (vId: string) => {
    if (pollingInterval) clearInterval(pollingInterval);

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-video-status', {
          body: { video_id: vId, analysis_id: analysisId }
        });

        if (error) {
          // Handle specific error codes
          if (error.status === 401) {
            toast.error('Session expirée, veuillez vous reconnecter');
            clearInterval(interval);
            setPollingInterval(null);
            return;
          }
          throw error;
        }

        console.log('[VideoSection] Poll result:', data);

        if (data.status === 'completed') {
          setVideoStatus('completed');
          setErrorMessage(null);
          clearInterval(interval);
          setPollingInterval(null);
          toast.success('✅ Vidéo générée avec succès');
          loadLatestVideo(); // Reload to get full video data
        } else if (data.status === 'failed' || data.error) {
          setVideoStatus('failed');
          setErrorMessage(data.error_message || data.error || 'Erreur HeyGen');
          clearInterval(interval);
          setPollingInterval(null);
          toast.error('❌ Échec de la génération vidéo');
        }
      } catch (err: any) {
        console.error('[VideoSection] Poll error:', err);
        
        // Stop polling on persistent errors
        if (err.status === 404 || err.status === 400 || err.code === 'NOT_FOUND') {
          clearInterval(interval);
          setPollingInterval(null);
          setVideoStatus('failed');
          setErrorMessage('Vidéo introuvable');
        }
      }
    }, 5000); // Poll every 5s (increased from 3s for better performance)

    setPollingInterval(interval);
  };

  const handleGenerate = async (avatarId: string, voiceId: string) => {
    try {
      setVideoStatus('processing');
      setErrorMessage(null);
      
      toast.info('🎬 Génération vidéo lancée...');

      const { data, error } = await supabase.functions.invoke('heygen-video-generator', {
        body: {
          action: 'generate',
          analysis_id: analysisId,
          avatar_id: avatarId,
          voice_id: voiceId,
          auto_generate_script: true
        }
      });

      if (error) {
        console.error('[VideoSection] Generation error:', error);
        
        // Handle specific error codes
        if (error.status === 402) {
          toast.error('Clé API HeyGen manquante ou crédits insuffisants');
        } else if (error.status === 429) {
          toast.error('Limite de requêtes HeyGen atteinte, réessayez plus tard');
        } else {
          toast.error(error.message || 'Erreur lors de la génération');
        }
        
        setVideoStatus('failed');
        setErrorMessage(error.message);
        return;
      }

      if (data.video_id) {
        setVideoId(data.video_id);
        startPolling(data.video_id);
        toast.success('Génération démarrée - polling en cours...');
      } else {
        throw new Error('Aucun video_id retourné par HeyGen');
      }

      setShowWizard(false);
    } catch (err: any) {
      console.error('[VideoSection] Fatal error:', err);
      setVideoStatus('failed');
      setErrorMessage(err.message || 'Erreur inconnue');
      toast.error('Erreur lors de la génération vidéo');
    }
  };

  const handleRetry = () => {
    setShowWizard(true);
    setVideoStatus('none');
    setErrorMessage(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Vidéo Produit (HeyGen)
              </CardTitle>
              <CardDescription>Générez une présentation vidéo avec avatar IA</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
            >
              <History className="w-4 h-4 mr-2" />
              Historique
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Display */}
          {videoStatus === 'none' && (
            <div className="text-center py-8">
              <Video className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground mb-4">
                Aucune vidéo générée pour ce produit
              </p>
              <Button onClick={() => setShowWizard(true)}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Générer une vidéo
              </Button>
            </div>
          )}

          {videoStatus === 'processing' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Génération en cours...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cela peut prendre 2-5 minutes
                </p>
              </div>
              <Badge variant="secondary">Video ID: {videoId?.substring(0, 12)}...</Badge>
            </div>
          )}

          {videoStatus === 'completed' && (
            <div className="space-y-4">
              <VideoPlayer analysisId={analysisId} />
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowWizard(true)}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                Générer une nouvelle vidéo
              </Button>
            </div>
          )}

          {videoStatus === 'failed' && (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Échec de la génération</p>
                {errorMessage && (
                  <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
                    {errorMessage}
                  </p>
                )}
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowHistory(true)}>
                  <History className="w-4 h-4 mr-2" />
                  Voir l'historique
                </Button>
                <Button onClick={handleRetry}>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Réessayer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizard */}
      {showWizard && (
        <HeyGenVideoWizard
          analysisId={analysisId}
          onGenerate={handleGenerate}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* History Dialog */}
      <VideoHistoryDialog
        analysisId={analysisId}
        open={showHistory}
        onOpenChange={setShowHistory}
      />
    </>
  );
}
