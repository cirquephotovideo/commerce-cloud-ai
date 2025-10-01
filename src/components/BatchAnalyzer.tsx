import React, { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Package, Barcode, Link, Loader2 } from "lucide-react";
import { Progress } from "./ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BatchAnalyzerProps {
  onAnalysisComplete: (results: any[]) => void;
}

export const BatchAnalyzer = ({ onAnalysisComplete }: BatchAnalyzerProps) => {
  const [batchInput, setBatchInput] = useState("");
  const [inputType, setInputType] = useState<"name" | "barcode" | "url">("name");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentProduct, setCurrentProduct] = useState("");

  const getPlaceholder = () => {
    switch (inputType) {
      case "name":
        return "iPhone 15 Pro\nSamsung Galaxy S24\nSony WH-1000XM5";
      case "barcode":
        return "1234567890123\n9876543210987\n5555555555555";
      case "url":
        return "https://amazon.com/product1\nhttps://amazon.com/product2\nhttps://amazon.com/product3";
    }
  };

  const analyzeBatch = async () => {
    const products = batchInput
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (products.length === 0) {
      toast.error("Veuillez entrer au moins un produit");
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    const results = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      setCurrentProduct(product);
      setProgress(((i + 1) / products.length) * 100);

      try {
        const { data, error } = await supabase.functions.invoke('product-analyzer', {
          body: { productInput: product, includeImages: true }
        });

        if (error) throw error;

        if (data.success) {
          // Auto-save to database with image URLs
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('product_analyses').insert({
              user_id: user.id,
              product_url: product,
              analysis_result: data.analysis,
              image_urls: data.imageUrls || [],
              tags: data.analysis?.tags_categories?.suggested_tags || []
            });
          }
          
          results.push({
            product,
            analysis: data.analysis,
            imageUrls: data.imageUrls || [],
            success: true
          });
        } else {
          results.push({
            product,
            error: data.error || 'Erreur d\'analyse',
            success: false
          });
        }
      } catch (error) {
        console.error('Error analyzing product:', error);
        results.push({
          product,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          success: false
        });
      }
    }

    setIsAnalyzing(false);
    setCurrentProduct("");
    
    const successCount = results.filter(r => r.success).length;
    toast.success(`Analyse terminée: ${successCount}/${products.length} produits analysés avec succès`);
    
    onAnalysisComplete(results);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse en Lot</CardTitle>
        <CardDescription>
          Analysez plusieurs produits à la fois en entrant un produit par ligne
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={inputType} onValueChange={(v) => setInputType(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="name">
              <Package className="w-4 h-4 mr-2" />
              Nom
            </TabsTrigger>
            <TabsTrigger value="barcode">
              <Barcode className="w-4 h-4 mr-2" />
              Code-barres
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link className="w-4 h-4 mr-2" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value={inputType} className="space-y-4">
            <Textarea
              placeholder={getPlaceholder()}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              rows={10}
              disabled={isAnalyzing}
            />

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Analyse en cours...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
                {currentProduct && (
                  <p className="text-sm text-muted-foreground">
                    Produit actuel: {currentProduct}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={analyzeBatch}
              disabled={isAnalyzing || !batchInput.trim()}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                "Analyser tous les produits"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
