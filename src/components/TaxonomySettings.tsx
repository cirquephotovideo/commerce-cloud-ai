import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, ShoppingCart, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TaxonomyType = "google" | "amazon";

export const TaxonomySettings = () => {
  const [taxonomyType, setTaxonomyType] = useState<TaxonomyType>("google");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [googleCount, setGoogleCount] = useState(0);
  const [amazonCount, setAmazonCount] = useState(0);

  useEffect(() => {
    loadSettings();
    loadTaxonomyCounts();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("taxonomy_settings")
        .select("taxonomy_type")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setTaxonomyType(data.taxonomy_type as TaxonomyType);
      }
    } catch (error) {
      console.error("Error loading taxonomy settings:", error);
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTaxonomyCounts = async () => {
    try {
      const [googleRes, amazonRes] = await Promise.all([
        fetch("/taxonomies/google-taxonomy-fr.json"),
        fetch("/taxonomies/amazon-taxonomy-fr.json")
      ]);

      const googleData = await googleRes.json();
      const amazonData = await amazonRes.json();

      setGoogleCount(googleData.categories?.length || 0);
      setAmazonCount(amazonData.categories?.length || 0);
    } catch (error) {
      console.error("Error loading taxonomy counts:", error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("taxonomy_settings")
        .upsert({
          user_id: user.id,
          taxonomy_type: taxonomyType,
          is_active: true
        }, {
          onConflict: "user_id"
        });

      if (error) throw error;

      toast.success("Paramètres de taxonomie sauvegardés");
    } catch (error) {
      console.error("Error saving taxonomy settings:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="w-5 h-5" />
          Configuration de la Taxonomie
        </CardTitle>
        <CardDescription>
          Choisissez le système de catégorisation pour vos produits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={taxonomyType} onValueChange={(value) => setTaxonomyType(value as TaxonomyType)}>
          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="google" id="google" />
            <div className="flex-1">
              <Label htmlFor="google" className="cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="font-semibold">Google Shopping Taxonomy</span>
                  <Badge variant="secondary">{googleCount}+ cat.</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Optimisé pour Google Merchant Center et Google Shopping
                </p>
              </Label>
            </div>
          </div>

          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="amazon" id="amazon" />
            <div className="flex-1">
              <Label htmlFor="amazon" className="cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4" />
                  <span className="font-semibold">Amazon Browse Tree</span>
                  <Badge variant="secondary">{amazonCount}+ cat.</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Optimisé pour Amazon Marketplace et sites e-commerce
                </p>
              </Label>
            </div>
          </div>
        </RadioGroup>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            ✓ Taxonomie en français uniquement
          </div>
          <div className="flex items-center gap-1">
            ✓ Catégorisation automatique via IA
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full"
        >
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Sauvegarder les paramètres
        </Button>
      </CardContent>
    </Card>
  );
};
