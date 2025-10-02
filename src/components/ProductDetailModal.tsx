import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ProductOverviewTab } from "./product-detail/ProductOverviewTab";
import { ProductImagesTab } from "./product-detail/ProductImagesTab";
import { ProductAdvancedTab } from "./product-detail/ProductAdvancedTab";
import { ProductMarketTab } from "./product-detail/ProductMarketTab";
import { ProductExportTab } from "./product-detail/ProductExportTab";
import { ProductActionsTab } from "./product-detail/ProductActionsTab";
import { ProductAmazonTab } from "./product-detail/ProductAmazonTab";

interface ProductAnalysis {
  id: string;
  product_url: string;
  analysis_result: any;
  mapped_category_name?: string | null;
  created_at: string;
  is_favorite: boolean;
  image_urls?: any;
  tags?: any;
  description_long?: string;
  competitive_pros?: any;
  competitive_cons?: any;
  use_cases?: any;
}

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: ProductAnalysis | null;
  allAnalyses: ProductAnalysis[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, currentState: boolean) => void;
  onReload: () => void;
}

export const ProductDetailModal = ({
  isOpen,
  onClose,
  analysis,
  allAnalyses,
  onDelete,
  onToggleFavorite,
  onReload,
}: ProductDetailModalProps) => {
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowLeft") handleNavigate("prev");
      if (e.key === "ArrowRight") handleNavigate("next");
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isOpen, analysis]);

  const handleNavigate = (direction: "prev" | "next") => {
    if (!analysis) return;
    const currentIndex = allAnalyses.findIndex((a) => a.id === analysis.id);
    const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < allAnalyses.length) {
      const newAnalysis = allAnalyses[newIndex];
      // We need to trigger a re-render with the new analysis
      // This should be handled by the parent component updating the analysis prop
    }
  };

  const currentIndex = analysis ? allAnalyses.findIndex((a) => a.id === analysis.id) : -1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < allAnalyses.length - 1;

  if (!analysis) return null;

  const productName = analysis.analysis_result?.product_name || 
                      analysis.analysis_result?.name || 
                      "Produit";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
        {/* Header with navigation */}
        <DialogHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNavigate("prev")}
                disabled={!canGoPrev}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <DialogTitle className="text-xl">
                {productName}
              </DialogTitle>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNavigate("next")}
                disabled={!canGoNext}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <span className="text-sm text-muted-foreground ml-2">
                {currentIndex + 1} / {allAnalyses.length}
              </span>
            </div>

            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Tabs Navigation */}
        <div className="px-6 pt-4 border-b bg-background sticky top-[73px] z-10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
              <TabsTrigger value="advanced">Analyses</TabsTrigger>
              <TabsTrigger value="amazon">📦 Amazon</TabsTrigger>
              <TabsTrigger value="market">Prix & Marché</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-145px)] px-6 pb-6">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="overview" className="mt-4">
              <ProductOverviewTab analysis={analysis} />
            </TabsContent>

            <TabsContent value="images" className="mt-4">
              <ProductImagesTab analysis={analysis} />
            </TabsContent>

            <TabsContent value="advanced" className="mt-4">
              <ProductAdvancedTab analysis={analysis} />
            </TabsContent>

            <TabsContent value="market" className="mt-4">
              <ProductMarketTab analysis={analysis} />
            </TabsContent>

            <TabsContent value="export" className="mt-4">
              <ProductExportTab analysisId={analysis.id} productName={productName} />
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              <ProductActionsTab
                analysis={analysis}
                onDelete={onDelete}
                onToggleFavorite={onToggleFavorite}
                onReload={onReload}
                onClose={onClose}
              />
            </TabsContent>

            <TabsContent value="amazon" className="mt-4">
              <ProductAmazonTab analysis={analysis} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
