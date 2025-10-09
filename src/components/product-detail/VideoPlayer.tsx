import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Video, AlertCircle, ExternalLink, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VideoPlayerProps {
  analysisId: string;
  showCard?: boolean;
}

export const VideoPlayer = ({ analysisId, showCard = true }: VideoPlayerProps) => {
  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestVideo();
  }, [analysisId]);

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

      {!loading && !error && video && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {getStatusBadge(video.status)}
            {video.video_url && (
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

          {video.status === 'processing' && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Génération en cours...</span>
              </div>
              <p className="text-xs text-muted-foreground">
                La génération peut prendre 1 à 3 minutes. La page se rafraîchira automatiquement.
              </p>
            </div>
          )}

          {video.status === 'failed' && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium mb-1">Erreur de génération</p>
              {video.error_message && (
                <p className="text-xs text-destructive/80">{video.error_message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Réessayez avec une autre configuration ou contactez le support.
              </p>
            </div>
          )}

          {video.status === 'completed' && video.video_url && (
            <div className="space-y-3">
              <video 
                controls 
                className="w-full rounded-lg border-2 border-border shadow-lg"
                src={video.video_url}
                poster={video.thumbnail_url || undefined}
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

          {video.status === 'completed' && video.thumbnail_url && !video.video_url && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <img 
                src={video.thumbnail_url} 
                alt="Miniature de la vidéo" 
                className="w-full rounded-md"
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Vidéo générée mais URL non disponible
              </p>
            </div>
          )}
        </div>
      )}
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
