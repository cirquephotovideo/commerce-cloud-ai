import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sparkles, Upload, Package, RefreshCw, DollarSign, TrendingUp, Truck, ImageIcon, Video, ShieldCheck, Trophy, FileText, Settings } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// Import du sélecteur et des sections
import { EnrichmentSelector, EnrichmentModule } from "./product-detail/EnrichmentSelector";
import { EnrichmentProgress } from "./product-detail/EnrichmentProgress";
import { OverviewSection } from "./product-detail/sections/OverviewSection";
import { PurchasePriceSection } from "./product-detail/sections/PurchasePriceSection";
import { SellingPriceSection } from "./product-detail/sections/SellingPriceSection";
import { SuppliersSection } from "./product-detail/sections/SuppliersSection";
import { AmazonSection } from "./product-detail/sections/AmazonSection";
import { ImagesSection } from "./product-detail/sections/ImagesSection";
import { VideoSection } from "./product-detail/sections/VideoSection";
import { RSGPSection } from "./product-detail/sections/RSGPSection";
import { CompetitorsSection } from "./product-detail/sections/CompetitorsSection";
import { StockSection } from "./product-detail/sections/StockSection";
import { DescriptionSection } from "./product-detail/sections/DescriptionSection";
import { SpecsSection } from "./product-detail/sections/SpecsSection";

interface ProductDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onExport?: (platform: string) => void;
  onEnrich?: () => void;
}

export function ProductDetailModal({ 
  open, 
  onOpenChange, 
  product,
  onExport,
  onEnrich
}: ProductDetailModalProps) {
  const [enabledModules, setEnabledModules] = useState<Set<string>>(
    new Set(['overview', 'purchase_price', 'selling_price', 'suppliers'])
  );

  const queryClient = useQueryClient();

  const reEnrichMutation = useMutation({
    mutationFn: async ({ provider = 'lovable-ai', types = ['amazon', 'ai_analysis'] }: { provider?: string; types?: string[] }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      const { data, error } = await supabase.functions.invoke('re-enrich-product', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: {
          productId: product.id,
          enrichmentTypes: types,
          provider
        }
      });

      if (error) {
        if (error.message.includes('401')) {
          throw new Error('Session expirée, veuillez vous reconnecter');
        }
        if (error.message.includes('429')) {
          throw new Error('Limite de taux atteinte, veuillez réessayer plus tard');
        }
        if (error.message.includes('402')) {
          throw new Error('Crédits insuffisants, veuillez recharger votre compte');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success('✨ Re-enrichissement démarré avec succès !');
      queryClient.invalidateQueries({ queryKey: ['product-analysis', product.id] });
      if (onEnrich) onEnrich();
    },
    onError: (error: Error) => {
      toast.error(`❌ Erreur lors du re-enrichissement : ${error.message}`);
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['product-analysis', product.id] });
    if (onEnrich) onEnrich();
  };

  if (!product) return null;

  const analysis = product.linked_analysis_id ? 
    { id: product.linked_analysis_id, ...product } : 
    null;

  // Déterminer la disponibilité des modules
  const hasAmazonData = product.amazon_enriched_at !== null;
  const hasVideoData = product.video_url !== null;
  const imageCount = product.image_urls?.length || 0;
  const hasImages = imageCount > 0;
  const hasRSGPData = product.enrichment_status?.rsgp === 'completed';
  const hasCompetitors = product.analysis_result?.competitors?.length > 0;
  const hasDescription = Boolean(
    product.analysis_result?.description?.suggested_description ||
    product.analysis_result?.description_long ||
    product.description
  );
  const hasSpecs = Boolean(
    product.analysis_result?.specifications ||
    product.analysis_result?.dimensions
  );

  // Configuration des modules
  const modules: EnrichmentModule[] = [
    { 
      id: 'overview', 
      label: 'Vue Globale', 
      icon: <Package className="h-3 w-3" />, 
      status: 'available', 
      enabled: true // Toujours activé
    },
    { 
      id: 'purchase_price', 
      label: 'Prix Achat', 
      icon: <DollarSign className="h-3 w-3" />, 
      status: 'available', 
      enabled: enabledModules.has('purchase_price') 
    },
    { 
      id: 'selling_price', 
      label: 'Prix Vente', 
      icon: <TrendingUp className="h-3 w-3" />, 
      status: 'available', 
      enabled: enabledModules.has('selling_price') 
    },
    { 
      id: 'suppliers', 
      label: 'Fournisseurs', 
      icon: <Truck className="h-3 w-3" />, 
      status: 'available', 
      enabled: enabledModules.has('suppliers') 
    },
    { 
      id: 'amazon', 
      label: 'Amazon', 
      icon: <Package className="h-3 w-3" />, 
      status: hasAmazonData ? 'available' : 'unavailable', 
      enabled: enabledModules.has('amazon') 
    },
    { 
      id: 'images', 
      label: 'Images', 
      icon: <ImageIcon className="h-3 w-3" />, 
      status: hasImages ? 'available' : 'unavailable', 
      enabled: enabledModules.has('images') 
    },
    { 
      id: 'video', 
      label: 'Vidéo', 
      icon: <Video className="h-3 w-3" />, 
      status: hasVideoData ? 'available' : 'pending', 
      enabled: enabledModules.has('video') 
    },
    { 
      id: 'rsgp', 
      label: 'RSGP', 
      icon: <ShieldCheck className="h-3 w-3" />, 
      status: hasRSGPData ? 'available' : 'unavailable', 
      enabled: enabledModules.has('rsgp') 
    },
    { 
      id: 'competitors', 
      label: 'Concurrents', 
      icon: <Trophy className="h-3 w-3" />, 
      status: hasCompetitors ? 'available' : 'unavailable', 
      enabled: enabledModules.has('competitors') 
    },
    { 
      id: 'stock', 
      label: 'Stock', 
      icon: <Package className="h-3 w-3" />, 
      status: 'available', 
      enabled: enabledModules.has('stock') 
    },
    { 
      id: 'description', 
      label: 'Description', 
      icon: <FileText className="h-3 w-3" />, 
      status: hasDescription ? 'available' : 'unavailable', 
      enabled: enabledModules.has('description') 
    },
    { 
      id: 'specs', 
      label: 'Specs', 
      icon: <Settings className="h-3 w-3" />, 
      status: hasSpecs ? 'available' : 'unavailable', 
      enabled: enabledModules.has('specs') 
    },
  ];

  const toggleModule = (id: string) => {
    if (id === 'overview') return; // Vue globale toujours active
    
    const newSet = new Set(enabledModules);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setEnabledModules(newSet);
  };

  const handleEnrichClick = (type: string) => {
    toast.info(`Enrichissement ${type} en cours de développement`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                {product.product_name}
              </div>
              {product.ean && (
                <div className="text-xs text-muted-foreground font-normal">
                  EAN: {product.ean} | Catégorie: {product.mapped_category_name || 'Non catégorisé'}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {product.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={reEnrichMutation.isPending}
                    >
                      {reEnrichMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                          Re-enrichissement...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-1" />
                          Re-enrichir
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => reEnrichMutation.mutate({ provider: 'lovable-ai' })}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Tout re-enrichir
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => reEnrichMutation.mutate({ types: ['amazon'] })}>
                      <Package className="h-4 w-4 mr-2" />
                      Amazon uniquement
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => reEnrichMutation.mutate({ types: ['ai_analysis'] })}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyse IA uniquement
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => reEnrichMutation.mutate({ types: ['ai_images'] })}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Générer images IA
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => reEnrichMutation.mutate({ types: ['video'] })}>
                      <Video className="h-4 w-4 mr-2" />
                      Générer vidéo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {onExport && analysis && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Upload className="w-4 h-4 mr-1" />
                      Exporter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onExport('shopify')}>
                      Shopify
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('woocommerce')}>
                      WooCommerce
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('prestashop')}>
                      PrestaShop
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('magento')}>
                      Magento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onExport('odoo')}>
                      Odoo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Indicateur de progression */}
        {analysis && <EnrichmentProgress analysisId={analysis.id} />}

        {/* Sélecteur d'enrichissements */}
        <EnrichmentSelector modules={modules} onToggle={toggleModule} />

        {/* Contenu dynamique */}
        <ScrollArea className="h-[70vh]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
            {/* Vue Globale (toujours visible) */}
            <OverviewSection 
              analysis={analysis || product} 
              onEnrichClick={handleEnrichClick}
            />

            {/* Prix d'achat */}
            {enabledModules.has('purchase_price') && analysis && (
              <PurchasePriceSection analysisId={analysis.id} />
            )}

            {/* Prix de vente */}
            {enabledModules.has('selling_price') && analysis && (
              <SellingPriceSection analysis={analysis} />
            )}

            {/* Fournisseurs */}
            {enabledModules.has('suppliers') && analysis && (
              <SuppliersSection analysisId={analysis.id} />
            )}

            {/* Amazon */}
            {enabledModules.has('amazon') && hasAmazonData && analysis && (
              <AmazonSection analysisId={analysis.id} onEnrich={handleRefresh} />
            )}

            {/* Images */}
            {enabledModules.has('images') && hasImages && (
              <ImagesSection analysis={analysis || product} onEnrich={handleRefresh} />
            )}

            {/* Vidéo */}
            {enabledModules.has('video') && hasVideoData && (
              <VideoSection analysis={analysis || product} onEnrich={handleRefresh} />
            )}

            {/* RSGP */}
            {enabledModules.has('rsgp') && hasRSGPData && (
              <RSGPSection analysis={analysis || product} onEnrich={handleRefresh} />
            )}

            {/* Concurrents */}
            {enabledModules.has('competitors') && hasCompetitors && (
              <CompetitorsSection analysis={analysis || product} />
            )}

            {/* Stock */}
            {enabledModules.has('stock') && analysis && (
              <StockSection analysisId={analysis.id} />
            )}

            {/* Description */}
            {enabledModules.has('description') && hasDescription && (
              <DescriptionSection analysis={analysis || product} onEnrich={handleRefresh} />
            )}

            {/* Specs */}
            {enabledModules.has('specs') && hasSpecs && (
              <SpecsSection analysis={analysis || product} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
