import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  TrendingUp, 
  DollarSign, 
  Target, 
  BarChart3, 
  FileText,
  Image as ImageIcon,
  Tag,
  Globe,
  MessageSquare,
  Loader2,
  Package,
  Barcode
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnalysisResults } from "./AnalysisResults";
import { useSubscription } from "@/contexts/SubscriptionContext";

const analysisTools = [
  { icon: Search, name: "Analyse SEO", description: "Optimisation du référencement" },
  { icon: DollarSign, name: "Analyse de Prix", description: "Stratégie tarifaire optimale" },
  { icon: Target, name: "Concurrence", description: "Positionnement marché" },
  { icon: TrendingUp, name: "Tendances", description: "Évolution du marché" },
  { icon: FileText, name: "Description", description: "Génération de contenu" },
  { icon: ImageIcon, name: "Optimisation Image", description: "Amélioration visuelle" },
  { icon: Tag, name: "Tags & Catégories", description: "Classification produit" },
  { icon: MessageSquare, name: "Avis Clients", description: "Analyse sentiment" },
  { icon: BarChart3, name: "Rapport Complet", description: "Synthèse détaillée" },
];

export const AnalyzerSection = () => {
  const [productInput, setProductInput] = useState("");
  const [inputType, setInputType] = useState<"url" | "name" | "barcode">("name");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const { canUseFeature } = useSubscription();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const trackUsage = async (featureType: string) => {
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    try {
      // Check if usage record exists for this month
      const { data: existing } = await supabase
        .from("usage_tracking")
        .select("id, usage_count")
        .eq("user_id", user.id)
        .eq("feature_type", featureType)
        .gte("period_start", startOfMonth.toISOString())
        .lte("period_end", endOfMonth.toISOString())
        .maybeSingle();

      if (existing) {
        // Update existing record
        await supabase
          .from("usage_tracking")
          .update({ usage_count: existing.usage_count + 1 })
          .eq("id", existing.id);
      } else {
        // Create new record
        await supabase
          .from("usage_tracking")
          .insert({
            user_id: user.id,
            feature_type: featureType,
            usage_count: 1,
            period_start: startOfMonth.toISOString(),
            period_end: endOfMonth.toISOString(),
          });
      }
    } catch (error) {
      console.error("Error tracking usage:", error);
    }
  };

  const analyzeProduct = async () => {
    if (!productInput.trim() || isAnalyzing) return;

    // Check if user can use this feature
    const canUse = await canUseFeature("product_analyses");
    if (!canUse) return;

    setIsAnalyzing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('product-analyzer', {
        body: { productInput }
      });

      if (error) throw error;

      setResults(data);

      // Auto-save if user is logged in
      if (user && data.success) {
        try {
          const { error: saveError } = await supabase
            .from("product_analyses")
            .insert({
              user_id: user.id,
              product_url: productInput,
              analysis_result: data.analysis,
            });

          if (saveError) throw saveError;

          // Track usage
          await trackUsage("product_analyses");

          toast.success("Analyse terminée et sauvegardée !");
        } catch (saveError: any) {
          toast.success("Analyse terminée !");
          toast.error("Erreur de sauvegarde: " + saveError.message);
        }
      } else {
        toast.success(user ? "Analyse terminée avec succès !" : "Analyse terminée ! Connectez-vous pour sauvegarder");
      }
    } catch (error: any) {
      console.error('Error:', error);
      if (error.message?.includes('429')) {
        toast.error("Trop de requêtes. Veuillez réessayer dans quelques instants.");
      } else {
        toast.error("Erreur lors de l'analyse du produit");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPlaceholder = () => {
    switch (inputType) {
      case "url":
        return "https://exemple.com/produit";
      case "barcode":
        return "3068320115900";
      default:
        return "iPhone 15 Pro Max, Sony A7 IV, Nike Air Max...";
    }
  };

  const getIcon = () => {
    switch (inputType) {
      case "url":
        return <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />;
      case "barcode":
        return <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />;
      default:
        return <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <section id="analyzer" className="py-12 sm:py-16 md:py-20 px-4 bg-gradient-card">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8 sm:mb-12 space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-secondary/10 border border-secondary/20">
            <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" />
            <span className="text-xs sm:text-sm font-medium text-secondary">Analyseur de Produits</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-4">
            9 Outils d'Analyse Automatisée
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Analysez vos produits avec 9 outils spécialisés : SEO, prix, concurrence, 
            tendances et génération de contenu marketing.
          </p>
        </div>

        <Card className="bg-card border-border backdrop-blur-sm shadow-card p-4 sm:p-6 mb-6 sm:mb-8 space-y-4">
          <Tabs value={inputType} onValueChange={(v) => setInputType(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="name" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-1.5 text-xs sm:text-sm">
                <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Nom de produit</span>
                <span className="sm:hidden">Nom</span>
              </TabsTrigger>
              <TabsTrigger value="barcode" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-1.5 text-xs sm:text-sm">
                <Barcode className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Code-barres</span>
                <span className="sm:hidden">Code</span>
              </TabsTrigger>
              <TabsTrigger value="url" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-1.5 text-xs sm:text-sm">
                <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>URL</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              {getIcon()}
              <Input
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeProduct()}
                placeholder={getPlaceholder()}
                disabled={isAnalyzing}
                className="pl-10 h-11 sm:h-12 bg-background border-border text-sm sm:text-base"
              />
            </div>
            <Button 
              onClick={analyzeProduct} 
              disabled={isAnalyzing || !productInput.trim()}
              size="lg"
              className="shadow-glow w-full sm:w-auto h-11 sm:h-12"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span className="text-sm sm:text-base">Analyse...</span>
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base">Analyser</span>
                </>
              )}
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {analysisTools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Card
                key={idx}
                className="bg-card border-border backdrop-blur-sm hover:border-primary/40 transition-all p-4 sm:p-6 space-y-2 sm:space-y-3 group cursor-pointer hover:shadow-card"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold">{tool.name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{tool.description}</p>
              </Card>
            );
          })}
        </div>

        {results && results.analysis && (
          <div className="mt-8">
            <AnalysisResults 
              analysis={results.analysis} 
              productInput={results.productInput}
              inputType={results.inputType}
            />
          </div>
        )}
      </div>
    </section>
  );
};
