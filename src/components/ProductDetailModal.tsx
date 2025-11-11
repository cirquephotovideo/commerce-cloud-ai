import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles, RefreshCw, ImageIcon, Video, Upload, Package, Truck, ShieldCheck, Trophy, FileText, Settings, DollarSign, Database, FileSpreadsheet } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

// Import des composants
import { CriticalInfoSection } from "./product-detail/CriticalInfoSection";
import { EnrichmentBadges } from "./product-detail/EnrichmentBadges";
import { EnrichmentPrompt } from "./product-detail/EnrichmentPrompt";
import { EnrichmentProgress } from "./product-detail/EnrichmentProgress";
import { OverviewSection } from "./product-detail/sections/OverviewSection";
import { PurchasePriceSection } from "./product-detail/sections/PurchasePriceSection";
import { SellingPriceSectionEditable } from "./product-detail/sections/SellingPriceSectionEditable";
import { SuppliersSection } from "./product-detail/sections/SuppliersSection";
import { AmazonSection } from "./product-detail/sections/AmazonSection";
import { ImagesSection } from "./product-detail/sections/ImagesSection";
import { VideoSection } from "./product-detail/sections/VideoSection";
import { RSGPSection } from "./product-detail/sections/RSGPSection";
import { CompetitorsSection } from "./product-detail/sections/CompetitorsSection";
import { StockSection } from "./product-detail/sections/StockSection";
import { DescriptionSection } from "./product-detail/sections/DescriptionSection";
import { SpecsSection } from "./product-detail/sections/SpecsSectionUpdated";
import { RepairabilitySection } from "./product-detail/sections/RepairabilitySection";
import { EnvironmentalSection } from "./product-detail/sections/EnvironmentalSection";
import { HSCodeSection } from "./product-detail/sections/HSCodeSection";
import { OdooAttributesSection } from "./product-detail/sections/OdooAttributesSection";
import { Code2AsinSection } from "./product-detail/sections/Code2AsinSection";
import { HeyGenVideoWizard } from "./product-detail/HeyGenVideoWizard";
import { useEnrichment } from "@/hooks/useEnrichment";
import { getRepairabilityData, getEnvironmentalData, getHSCodeData } from "@/lib/analysisDataExtractors";
import { EnrichmentProviderSelector, AIProvider } from "./product-detail/EnrichmentProviderSelector";

interface ProductDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onExport?: (platform: string) => void;
  onEnrich?: () => void;
  initialTab?: string;
}

export function ProductDetailModal({ 
  open, 
  onOpenChange, 
  product,
  onExport,
  onEnrich,
  initialTab
}: ProductDetailModalProps) {
  const [showVideoWizard, setShowVideoWizard] = useState(false);
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Mapping des sections vers les IDs d'accordion
  const sectionToAccordionMap: Record<string, string> = {
    'specifications': 'specs',
    'cost_analysis': 'specs',
    'technical_description': 'description',
    'amazon': 'amazon',
    'video': 'video',
    'images': 'images',
    'rsgp': 'rsgp',
    'overview': 'overview',
    'description': 'description',
  };

  // Récupérer l'analyse complète
  const { data: analysis } = useQuery({
    queryKey: ['product-analysis', product?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_analyses')
        .select('*, amazon_product_data(*)')
        .eq('id', product.linked_analysis_id || product.id)
        .maybeSingle();
      return data;
    },
    enabled: !!product?.id && open
  });

  // Récupérer les données Code2ASIN
  const { data: code2asinData } = useQuery({
    queryKey: ['code2asin-enrichment', analysis?.id],
    queryFn: async () => {
      if (!analysis?.id) return null;
      const { data, error } = await supabase
        .from('code2asin_enrichments')
        .select('*')
        .eq('analysis_id', analysis.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching code2asin data:', error);
        return null;
      }
      return data;
    },
    enabled: !!analysis?.id && open
  });

  // Hook d'enrichissement
  const enrichmentMutation = useEnrichment(product?.id, () => {
    handleRefresh();
  });

  // Mutation de re-enrichissement global
  const reEnrichMutation = useMutation({
    mutationFn: async ({ provider = 'lovable-ai', types = ['amazon', 'ai_analysis'] }: { provider?: string; types?: string[] }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Session expirée');

      const { data, error } = await supabase.functions.invoke('re-enrich-product', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { productId: product.id, enrichmentTypes: types, provider }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('✨ Re-enrichissement démarré !');
      handleRefresh();
    },
    onError: (error: Error) => {
      toast.error(`❌ ${error.message}`);
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['product-analysis', product.id] });
    queryClient.invalidateQueries({ queryKey: ['enrichment-queue', analysis?.id] });
    queryClient.invalidateQueries({ queryKey: ['code2asin-enrichment', analysis?.id] });
    if (onEnrich) onEnrich();
  };

  // Écouter les changements d'onglet depuis l'extérieur
  useEffect(() => {
    const handleTabNavigation = (e: CustomEvent) => {
      const targetSection = e.detail.tabName;
      const accordionId = sectionToAccordionMap[targetSection] || targetSection;
      
      // Ouvrir l'accordion correspondant
      setActiveAccordion(prev => {
        if (!prev.includes(accordionId)) {
          return [...prev, accordionId];
        }
        return prev;
      });
      
      // Scroll vers la section après un court délai
      setTimeout(() => {
        const section = document.getElementById(`section-${accordionId}`);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    };
    
    window.addEventListener('navigate-to-tab', handleTabNavigation as EventListener);
    
    return () => {
      window.removeEventListener('navigate-to-tab', handleTabNavigation as EventListener);
    };
  }, []);

  // Réinitialiser l'accordion à l'ouverture
  useEffect(() => {
    if (open && initialTab) {
      const accordionId = sectionToAccordionMap[initialTab] || initialTab;
      setActiveAccordion([accordionId]);
    } else if (!open) {
      setActiveAccordion([]);
    }
  }, [open, initialTab]);

  const handleEnrich = async (type: string) => {
    const typeMap: Record<string, string[]> = {
      amazon: ['amazon'],
      images: ['images'],
      video: ['video'],
      rsgp: ['rsgp'],
      description: ['description'],
      specs: ['specifications']
    };
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Non authentifié");
        return;
      }

      const enrichmentTypes = typeMap[type] || [type];

      // Note: supplier_product_id peut être NULL pour certaines analyses
      // La fonction enrich-odoo-attributes utilisera les données de analysis_result en fallback
      
      // Add task to queue
      const { error: insertError } = await supabase
        .from("enrichment_queue")
        .insert({
          user_id: user.id,
          supplier_product_id: product.supplier_product_id || null,
          analysis_id: product.id,
          enrichment_type: enrichmentTypes,
          priority: "high",
          status: "pending",
        });

      if (insertError) {
        console.error('[ProductDetail] Queue insert error:', insertError);
        toast.error(`Erreur: ${insertError.message}`);
        return;
      }

      toast.success(`✨ Enrichissement ${type} ajouté à la file`);

      // Trigger processing
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'process-enrichment-queue',
        { body: { maxItems: 1 } }
      );

      if (processError) {
        console.error('[ProductDetail] Processing error:', processError);
        toast.warning("⏳ Enrichissement en file, vérifiez le Dashboard");
      } else {
        toast.success("🚀 Enrichissement démarré !");
      }

      // Refresh after 3 seconds
      setTimeout(() => handleRefresh(), 3000);
    } catch (error: any) {
      console.error("[ProductDetail] Enrichment error:", error);
      toast.error("❌ Erreur lors de l'enrichissement");
    }
  };

  const handleBadgeClick = (type: string) => {
    // Scroll to the section in accordion
    const element = document.getElementById(`section-${type}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGenerateImages = () => {
    enrichmentMutation.mutate({ enrichmentType: ['images'] });
  };

  const handleGenerateVideo = () => {
    setShowVideoWizard(true);
  };

  const handleEnrichOdooAttributes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Non authentifié");
        return;
      }

      // Appel direct à enrich-odoo-attributes (pas de queue intermédiaire)
      toast.loading("⏳ Enrichissement des attributs Odoo en cours...");

      const { data, error } = await supabase.functions.invoke(
        'enrich-odoo-attributes',
        { 
        body: { 
          analysisId: product.id,
          provider: 'lovable',
          webSearchEnabled: true
        }
        }
      );

      if (error) {
        console.error('[ProductDetail] Odoo enrichment error:', error);
        toast.error(`❌ Erreur: ${error.message}`);
        return;
      }

      toast.success('✨ Attributs Odoo enrichis avec succès !');
      console.log('[ProductDetail] Odoo attributes enriched:', data);

      // Rafraîchir après 1 seconde
      setTimeout(() => handleRefresh(), 1000);
    } catch (error: any) {
      console.error("[ProductDetail] Odoo Attributes enrichment error:", error);
      toast.error("❌ Erreur lors de l'enrichissement des attributs");
    }
  };

  if (!product) return null;

  // Calculer le statut d'enrichissement
  const hasAmazonData = product.amazon_enriched_at !== null;
  const hasVideoData = product.video_url !== null;
  const analysisImages = Array.isArray(analysis?.image_urls) ? analysis.image_urls : [];
  const amazonData = analysis?.amazon_product_data || null;
  const amazonImages = Array.isArray(amazonData?.images) ? amazonData.images : [];
  const imageCount = analysisImages.length + amazonImages.length;
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
  const hasRepairabilityData = Boolean(getRepairabilityData(analysis));
  const hasEnvironmentalData = Boolean(getEnvironmentalData(analysis));
  const hasHSCodeData = Boolean(getHSCodeData(analysis));
  const hasOdooAttributes = Boolean(
    analysis?.odoo_attributes && 
    Object.keys(analysis.odoo_attributes).length > 0
  );

  // Compter les fournisseurs
  const supplierCount = product.supplier_count || 0;

  // Statut d'enrichissement pour badges
  const enrichmentStatus = {
    images: { status: hasImages ? 'available' : 'missing', count: imageCount } as const,
    video: { status: hasVideoData ? 'available' : 'missing' } as const,
    amazon: { status: hasAmazonData ? 'available' : 'missing' } as const,
    description: { status: hasDescription ? 'available' : 'missing' } as const,
    rsgp: { status: hasRSGPData ? 'available' : 'missing' } as const,
    specs: { status: hasSpecs ? 'available' : 'missing' } as const,
    odoo_attributes: { status: hasOdooAttributes ? 'available' : 'missing', count: hasOdooAttributes ? Object.keys(analysis?.odoo_attributes || {}).length : undefined } as const
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {product.analysis_result?.product_name || product.analysis_result?.name || product.product_name || product.name || 'Produit sans nom'}
              {product.ean && (
                <span className="text-sm text-muted-foreground ml-3">
                  EAN: {product.ean}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Progress d'enrichissement */}
            {analysis?.id && <EnrichmentProgress analysisId={analysis.id} />}

            {/* Section Critique - TOUJOURS VISIBLE */}
            <CriticalInfoSection
              product={product}
              analysis={analysis}
              supplierCount={supplierCount}
              onUpdate={handleRefresh}
            />

            {/* Badges Enrichissement - INTERACTIFS */}
            <div className="px-4">
              <div className="text-sm font-medium mb-2">État des Enrichissements</div>
              <EnrichmentBadges
                enrichmentStatus={enrichmentStatus}
                onBadgeClick={handleBadgeClick}
              />
            </div>

            {/* Actions Rapides */}
            <div className="flex flex-wrap gap-2 px-4">
              <Button
                onClick={() => setShowProviderSelector(true)}
                disabled={reEnrichMutation.isPending}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-enrichir avec IA
              </Button>
              <Button
                onClick={() => reEnrichMutation.mutate({ provider: 'lovable-ai', types: ['amazon'] })}
                disabled={reEnrichMutation.isPending}
                variant="outline"
                className="bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30"
              >
                <Package className="h-4 w-4 mr-2" />
                Enrichir Amazon (Manuel)
              </Button>
              <Button
                onClick={handleGenerateImages}
                disabled={enrichmentMutation.isPending}
                variant="outline"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Générer Images IA
              </Button>
              <Button
                onClick={handleGenerateVideo}
                variant="outline"
              >
                <Video className="h-4 w-4 mr-2" />
                Générer Vidéo HeyGen
              </Button>
              <Button
                onClick={handleEnrichOdooAttributes}
                variant="outline"
                className="bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30"
              >
                <Database className="h-4 w-4 mr-2" />
                Enrichir Attributs Odoo
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                      toast.error("Non authentifié");
                      return;
                    }

                    toast.loading("🌐 Recherche Web (Ollama) démarrée...");

                    const analysisData = analysis?.analysis_result as any;
                    const productData = {
                      name: product.product_name || analysisData?.name,
                      brand: analysisData?.brand || null,
                      supplier_reference: analysisData?.sku || analysisData?.mpn || product.supplier_reference || null,
                      ean: product.ean || analysisData?.ean || analysisData?.barcode || null,
                      category: product.mapped_category_name || analysisData?.category || null
                    };

                    const purchasePrice = product.purchase_price || analysisData?.purchase_price || null;

                    const { data: sessionData } = await supabase.auth.getSession();
                    const { error } = await supabase.functions.invoke('enrich-all', {
                      headers: sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {},
                      body: { analysisId: product.id, productData, purchasePrice }
                    });

                    if (error) throw error;

                    toast.success('✨ Recherche Web démarrée !');
                    setTimeout(() => handleRefresh(), 2000);
                  } catch (error: any) {
                    toast.error(`❌ Erreur: ${error.message}`);
                  }
                }}
                variant="outline"
                className="bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Recherche Web (Ollama)
              </Button>
              {onExport && (
                <Button
                  onClick={() => onExport('shopify')}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              )}
            </div>

            {/* DÉTAILS ÉTENDUS - ACCORDION */}
            <ScrollArea className="h-[60vh] px-4">
              <Accordion 
                type="multiple" 
                className="space-y-2"
                value={activeAccordion}
                onValueChange={setActiveAccordion}
              >
                {/* Vue Globale */}
                <AccordionItem value="overview" id="section-overview">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Vue Globale
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {analysis ? (
                      <OverviewSection analysis={analysis} />
                    ) : (
                      <p className="text-muted-foreground">Aucune analyse disponible</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Réparabilité */}
                <AccordionItem value="repairability" id="section-repairability">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Réparabilité
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasRepairabilityData && analysis ? (
                      <RepairabilitySection analysis={analysis} />
                    ) : (
                      <p className="text-muted-foreground">Aucune donnée de réparabilité disponible</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Impact Environnemental */}
                <AccordionItem value="environmental" id="section-environmental">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Impact Environnemental
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasEnvironmentalData && analysis ? (
                      <EnvironmentalSection analysis={analysis} />
                    ) : (
                      <p className="text-muted-foreground">Aucune donnée environnementale disponible</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Code Douanier */}
                <AccordionItem value="hscode" id="section-hscode">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Code Douanier
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasHSCodeData && analysis ? (
                      <HSCodeSection analysis={analysis} />
                    ) : (
                      <p className="text-muted-foreground">Aucun code douanier disponible</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Fournisseurs - TOUJOURS AFFICHER */}
                <AccordionItem value="suppliers" id="section-suppliers">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Fournisseurs ({supplierCount})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {analysis?.id ? (
                      <div className="space-y-4">
                        <PurchasePriceSection analysisId={analysis.id} />
                        <SuppliersSection analysisId={analysis.id} />
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Aucun fournisseur lié</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Prix de Vente */}
                <AccordionItem value="selling" id="section-selling">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Prix de Vente
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {analysis ? (
                      <SellingPriceSectionEditable 
                        analysis={analysis} 
                        onUpdate={handleRefresh}
                      />
                    ) : (
                      <p className="text-muted-foreground">Aucune analyse disponible</p>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Images - TOUJOURS AFFICHER */}
                <AccordionItem value="images" id="section-images">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Images ({imageCount})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasImages && analysis ? (
                      <ImagesSection analysis={analysis} onEnrich={handleRefresh} />
                    ) : (
                      <EnrichmentPrompt 
                        type="images" 
                        onEnrich={() => handleEnrich('images')}
                        isLoading={enrichmentMutation.isPending}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Vidéo - TOUJOURS AFFICHER */}
                <AccordionItem value="video" id="section-video">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Vidéo
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {analysis ? (
                      <VideoSection analysis={analysis} onEnrich={handleRefresh} />
                    ) : (
                      <EnrichmentPrompt 
                        type="video" 
                        onEnrich={handleGenerateVideo}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Amazon - TOUJOURS AFFICHER */}
                <AccordionItem value="amazon" id="section-amazon">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Amazon
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasAmazonData && analysis ? (
                      <AmazonSection analysisId={analysis.id} onEnrich={handleRefresh} />
                    ) : (
                      <EnrichmentPrompt 
                        type="amazon" 
                        onEnrich={() => handleEnrich('amazon')}
                        isLoading={enrichmentMutation.isPending}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Description - TOUJOURS AFFICHER */}
                <AccordionItem value="description" id="section-description">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Description
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasDescription && analysis ? (
                      <DescriptionSection analysis={analysis} onEnrich={handleRefresh} />
                    ) : (
                      <EnrichmentPrompt 
                        type="description" 
                        onEnrich={() => handleEnrich('description')}
                        isLoading={enrichmentMutation.isPending}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Spécifications - TOUJOURS AFFICHER */}
                <AccordionItem value="specs" id="section-specs">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Spécifications Techniques
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasSpecs && analysis ? (
                      <SpecsSection analysis={analysis} />
                    ) : (
                      <EnrichmentPrompt 
                        type="specs" 
                        onEnrich={() => handleEnrich('specs')}
                        isLoading={enrichmentMutation.isPending}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Attributs Odoo - TOUJOURS AFFICHER */}
                <AccordionItem value="odoo_attributes" id="section-odoo_attributes">
                  <AccordionTrigger className="hover:bg-accent px-4 py-3 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      <span className="font-semibold">Attributs Odoo</span>
                      {hasOdooAttributes && analysis?.odoo_attributes ? (
                        <Badge variant="default" className="ml-2">
                          {Object.keys(analysis.odoo_attributes).length} attributs
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="ml-2">Non enrichi</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <OdooAttributesSection product={product} analysis={analysis} />
                  </AccordionContent>
                </AccordionItem>

                {/* RSGP - TOUJOURS AFFICHER */}
                <AccordionItem value="rsgp" id="section-rsgp">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      RSGP / Conformité
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {hasRSGPData && analysis ? (
                      <RSGPSection analysis={analysis} />
                    ) : (
                      <EnrichmentPrompt 
                        type="rsgp" 
                        onEnrich={() => handleEnrich('rsgp')}
                        isLoading={enrichmentMutation.isPending}
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Concurrents */}
                {hasCompetitors && analysis && (
                  <AccordionItem value="competitors" id="section-competitors">
                    <AccordionTrigger className="text-lg font-semibold">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5" />
                        Concurrents
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <CompetitorsSection analysis={analysis} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Stock */}
                {analysis && (
                  <AccordionItem value="stock" id="section-stock">
                    <AccordionTrigger className="text-lg font-semibold">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Stock
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <StockSection analysisId={analysis.id} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Code2ASIN - TOUJOURS AFFICHER */}
                <AccordionItem value="code2asin" id="section-code2asin">
                  <AccordionTrigger className="text-lg font-semibold">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Code2ASIN
                      {code2asinData ? (
                        <Badge variant="default" className="ml-2">Enrichi</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-2">Non enrichi</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {code2asinData ? (
                      <Code2AsinSection enrichmentData={code2asinData} />
                    ) : (
                      <div className="p-4 text-center text-muted-foreground">
                        <p className="mb-2">Aucune donnée Code2ASIN disponible</p>
                        <p className="text-sm">
                          Exportez vos EAN, enrichissez-les via code2asin.com, puis importez le CSV enrichi.
                        </p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Wizard */}
      {showVideoWizard && analysis && (
        <HeyGenVideoWizard
          analysisId={analysis.id}
          onGenerate={() => {
            setShowVideoWizard(false);
            handleRefresh();
          }}
          onClose={() => setShowVideoWizard(false)}
        />
      )}
      
      {/* Provider Selector for Re-enrichment */}
      <EnrichmentProviderSelector
        open={showProviderSelector}
        onOpenChange={setShowProviderSelector}
        onSelect={(provider: AIProvider) => {
          const providerMap: Record<AIProvider, string> = {
            'lovable': 'lovable-ai',
            'claude': 'claude',
            'openai': 'openai',
            'openrouter': 'openrouter',
            'ollama_cloud': 'ollama_cloud',
            'ollama_local': 'ollama_local'
          };
          reEnrichMutation.mutate({ 
            provider: providerMap[provider],
            types: ['amazon', 'ai_analysis', 'images', 'rsgp'] 
          });
        }}
      />
    </>
  );
}
