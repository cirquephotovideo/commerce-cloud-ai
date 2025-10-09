import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Star, Trash2, RefreshCw, Download, ExternalLink, Calendar, Package, Video, FileCheck, Loader2, Play } from "lucide-react";
import { HeyGenVideoWizard } from "./HeyGenVideoWizard";
import { VideoPlayer } from "./VideoPlayer";
import { toast } from "sonner";
import { getProductName } from "@/lib/analysisDataExtractors";
import { supabase } from "@/integrations/supabase/client";

interface ProductActionsTabProps {
  analysis: any;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, currentState: boolean) => void;
  onReload: () => void;
  onClose: () => void;
}

export const ProductActionsTab = ({ 
  analysis, 
  onDelete, 
  onToggleFavorite, 
  onReload,
  onClose 
}: ProductActionsTabProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegeneratingAmazon, setIsRegeneratingAmazon] = useState(false);
  const [isRegeneratingHeygen, setIsRegeneratingHeygen] = useState(false);
  const [isRegeneratingRsgp, setIsRegeneratingRsgp] = useState(false);
  const [showHeygenWizard, setShowHeygenWizard] = useState(false);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  
  const [amazonStatus, setAmazonStatus] = useState<string>('not_started');
  const [heygenStatus, setHeygenStatus] = useState<string>('not_started');
  const [rsgpStatus, setRsgpStatus] = useState<string>('not_started');
  
  const productName = getProductName(analysis);
  const isFavorite = analysis?.is_favorite || false;

  useEffect(() => {
    // Récupérer les statuts d'enrichissement
    const enrichmentStatus = analysis?.enrichment_status || {};
    setAmazonStatus(enrichmentStatus.amazon || 'not_started');
    setHeygenStatus(enrichmentStatus.heygen || 'not_started');
    setRsgpStatus(enrichmentStatus.rsgp || 'not_started');
  }, [analysis]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(analysis.id);
      toast.success("Produit supprimé");
      onClose();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = () => {
    onToggleFavorite(analysis.id, isFavorite);
  };

  const handleDownloadJSON = () => {
    const dataStr = JSON.stringify(analysis, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${productName.replace(/[^a-z0-9]/gi, "_")}_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Rapport téléchargé");
  };

  const handleShare = () => {
    navigator.clipboard.writeText(analysis.product_url);
    toast.success("Lien copié dans le presse-papiers");
  };

  const handleRegenerateAmazon = async () => {
    if (!analysis?.amazon_asin) {
      toast.error("ASIN manquant pour la régénération Amazon");
      return;
    }
    
    setIsRegeneratingAmazon(true);
    setAmazonStatus('processing');
    
    try {
      const { data, error } = await supabase.functions.invoke('amazon-product-enrichment', {
        body: { 
          analysis_id: analysis.id,
          asin: analysis.amazon_asin,
          force_refresh: true
        }
      });
      
      if (error) throw error;
      
      toast.success("Données Amazon régénérées avec succès");
      setAmazonStatus('completed');
      onReload();
    } catch (error: any) {
      console.error("Erreur régénération Amazon:", error);
      toast.error(error.message || "Erreur lors de la régénération Amazon");
      setAmazonStatus('error');
    } finally {
      setIsRegeneratingAmazon(false);
    }
  };

  const handleRegenerateHeygen = async (avatarId: string, voiceId: string, customScript?: string) => {
    // Vérifier si une vidéo est déjà en cours
    const { data: existingVideo } = await supabase
      .from('product_videos')
      .select('status')
      .eq('analysis_id', analysis.id)
      .in('status', ['processing', 'pending'])
      .maybeSingle();
    
    if (existingVideo) {
      toast.error("Une vidéo est déjà en cours de génération pour ce produit");
      return;
    }
    
    setIsRegeneratingHeygen(true);
    setHeygenStatus('processing');
    setVideoGenerationProgress(0);
    
    try {
      const { data, error } = await supabase.functions.invoke('heygen-video-generator', {
        body: { 
          action: 'generate',
          analysis_id: analysis.id,
          avatar_id: avatarId,
          voice_id: voiceId,
          custom_script: customScript,
          auto_generate_script: !customScript || customScript.trim() === ''
        }
      });

      if (error) {
        const backendMsg = (data as any)?.error || error.message || 'Erreur lors de la génération vidéo';
        throw new Error(backendMsg);
      }

      const generatedVideoId = data?.video_id;
      setVideoId(generatedVideoId);
      
      if (!generatedVideoId) {
        console.warn('[HEYGEN] No video_id returned from generation');
        toast.warning("Vidéo lancée mais impossible de suivre le statut");
        return;
      }
      
      // Démarrer le monitoring
      startVideoMonitoring(generatedVideoId);

      toast.success("🎬 Génération vidéo lancée ! Suivez la progression ci-dessous ou dans l'onglet Vue d'ensemble.");
    } catch (error: any) {
      console.error("Erreur régénération HeyGen:", error);
      toast.error(error.message || "Erreur lors de la génération vidéo");
      setHeygenStatus('error');
      setIsRegeneratingHeygen(false);
    }
  };

  const startVideoMonitoring = (videoId: string) => {
    console.log('[HEYGEN] Starting video monitoring for:', videoId);

    const pollStatus = async (retryCount = 0) => {
      try {
        const { data, error } = await supabase.functions.invoke('heygen-video-generator', {
          body: { 
            action: 'check_status',
            analysis_id: analysis.id,
            video_id: videoId
          }
        });

        if (error) {
          // Handle 404 with retry mechanism for initial polls
          if (error.message?.includes('404') && retryCount < 3) {
            console.log(`[HEYGEN] Video not found yet, retry ${retryCount + 1}/3 in ${2 ** (retryCount + 1)}s...`);
            const backoffDelay = 2000 * (2 ** retryCount); // 2s, 4s, 8s
            setTimeout(() => pollStatus(retryCount + 1), backoffDelay);
            return;
          }
          throw error;
        }

        console.log('[HEYGEN] Status check:', data);
        
        const progress = data?.progress || 0;
        setVideoGenerationProgress(progress);
        
        if (data?.status === 'completed') {
          setHeygenStatus('completed');
          setIsRegeneratingHeygen(false);
          setVideoGenerationProgress(100);
          toast.success("Vidéo générée avec succès !");
          onReload();
        } else if (data?.status === 'failed') {
          setHeygenStatus('error');
          setIsRegeneratingHeygen(false);
          toast.error("Erreur lors de la génération de la vidéo");
        } else {
          // Continue polling
          setTimeout(() => pollStatus(0), 5000);
        }
      } catch (error: any) {
        console.error('[HEYGEN] Monitoring error:', error);
        setHeygenStatus('error');
        setIsRegeneratingHeygen(false);
        const errorMsg = error.message || JSON.stringify(error);
        toast.error(`Erreur: ${errorMsg}`);
      }
    };

    // Wait 2 seconds before first poll to let DB commit
    setTimeout(() => pollStatus(0), 2000);
  };

  const handleRegenerateRsgp = async () => {
    setIsRegeneratingRsgp(true);
    setRsgpStatus('processing');
    
    try {
      const { data, error } = await supabase.functions.invoke('rsgp-compliance-generator', {
        body: { 
          analysis_id: analysis.id,
          force_regenerate: true
        }
      });
      
      if (error) throw error;
      
      toast.success("Conformité RSGP régénérée avec succès");
      setRsgpStatus('completed');
      onReload();
    } catch (error: any) {
      console.error("Erreur régénération RSGP:", error);
      toast.error(error.message || "Erreur lors de la régénération RSGP");
      setRsgpStatus('error');
    } finally {
      setIsRegeneratingRsgp(false);
    }
  };

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'completed': return 'Complété';
      case 'processing': return 'En cours';
      case 'error': return 'Erreur';
      case 'not_started': return 'Non généré';
      default: return status;
    }
  };

  const createdAt = new Date(analysis.created_at).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
          <CardDescription>
            Gérez ce produit et ses données
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant={isFavorite ? "default" : "outline"}
            className="w-full justify-start"
            onClick={handleToggleFavorite}
          >
            <Star className={`w-4 h-4 mr-2 ${isFavorite ? "fill-current" : ""}`} />
            {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleDownloadJSON}
          >
            <Download className="w-4 h-4 mr-2" />
            Télécharger le rapport JSON
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleShare}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Copier le lien du produit
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              window.open(analysis.product_url, "_blank");
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Voir sur le site source
          </Button>
        </CardContent>
      </Card>

      {/* Enrichissements */}
      <Card>
        <CardHeader>
          <CardTitle>Enrichissements</CardTitle>
          <CardDescription>
            Générez ou régénérez les enrichissements de ce produit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Amazon Product Data */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Données Amazon</p>
                <p className="text-xs text-muted-foreground">
                  Enrichissement via Amazon Product Advertising API
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(amazonStatus)}>
                {formatStatus(amazonStatus)}
              </Badge>
              <Button 
                size="sm" 
                onClick={handleRegenerateAmazon}
                disabled={isRegeneratingAmazon || !analysis?.amazon_asin}
              >
                {isRegeneratingAmazon ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 
                    En cours...
                  </>
                ) : amazonStatus === 'completed' ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" /> 
                    Régénérer
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1" /> 
                    Générer
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* HeyGen Video */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Vidéo Démo HeyGen</p>
                  <p className="text-xs text-muted-foreground">
                    Génération de vidéo promotionnelle avec avatar IA
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getBadgeVariant(heygenStatus)}>
                  {formatStatus(heygenStatus)}
                </Badge>
                <Button 
                  size="sm" 
                  onClick={() => setShowHeygenWizard(true)}
                  disabled={isRegeneratingHeygen}
                >
                  {isRegeneratingHeygen ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 
                      {videoGenerationProgress}%
                    </>
                  ) : heygenStatus === 'completed' ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1" /> 
                      Régénérer
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 mr-1" /> 
                      Générer
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* VideoPlayer Component */}
            <VideoPlayer analysisId={analysis.id} showCard={false} />
          </div>

          {/* RSGP Compliance */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Conformité RSGP</p>
                <p className="text-xs text-muted-foreground">
                  Analyse de conformité réglementaire européenne
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(rsgpStatus)}>
                {formatStatus(rsgpStatus)}
              </Badge>
              <Button 
                size="sm" 
                onClick={handleRegenerateRsgp}
                disabled={isRegeneratingRsgp}
              >
                {isRegeneratingRsgp ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 
                    En cours...
                  </>
                ) : rsgpStatus === 'completed' ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" /> 
                    Régénérer
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1" /> 
                    Générer
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Date d'analyse</span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{createdAt}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Statut</span>
            <Badge variant={isFavorite ? "default" : "secondary"}>
              {isFavorite ? "Favori" : "Standard"}
            </Badge>
          </div>

          {analysis.mapped_category_name && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Catégorie</span>
              <Badge variant="outline">{analysis.mapped_category_name}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Zone Dangereuse</CardTitle>
          <CardDescription>
            Actions irréversibles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-start" disabled={isDeleting}>
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? "Suppression..." : "Supprimer l'analyse"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer l'analyse de <strong>{productName}</strong> ?
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Wizard HeyGen */}
      {showHeygenWizard && (
        <HeyGenVideoWizard
          analysisId={analysis.id}
          onGenerate={handleRegenerateHeygen}
          onClose={() => setShowHeygenWizard(false)}
        />
      )}
    </div>
  );
};
