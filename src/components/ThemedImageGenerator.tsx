import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ThemedImageGeneratorProps {
  productName: string;
  onImageGenerated?: (imageUrl: string) => void;
}

const THEMES = [
  { value: "safari", label: "🦁 Scène Safari", prompt: "in a beautiful safari scene with African wildlife and savanna landscape" },
  { value: "urban", label: "🏙️ Environnement Urbain", prompt: "in a modern urban environment with city skyline and street lights" },
  { value: "nature", label: "🌿 Contexte Naturel", prompt: "in a serene natural setting with lush greenery and natural lighting" },
  { value: "lifestyle", label: "🎨 Lifestyle Moderne", prompt: "in a trendy lifestyle setting with modern interior design" },
  { value: "beach", label: "🏖️ Plage Paradisiaque", prompt: "on a beautiful tropical beach with crystal clear water and white sand" },
  { value: "winter", label: "❄️ Paysage d'Hiver", prompt: "in a winter wonderland with snow-covered mountains and cozy atmosphere" },
  { value: "night", label: "🌙 Scène Nocturne", prompt: "in a stunning nighttime scene with dramatic lighting and stars" },
  { value: "minimalist", label: "⚪ Minimaliste", prompt: "in a clean minimalist setting with simple geometric shapes and neutral colors" },
];

export const ThemedImageGenerator = ({ productName, onImageGenerated }: ThemedImageGeneratorProps) => {
  const [selectedTheme, setSelectedTheme] = useState<string>("safari");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedTheme) {
      toast.error("Sélectionnez un thème");
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const theme = THEMES.find(t => t.value === selectedTheme);
      const prompt = `Professional product photography of ${productName} ${theme?.prompt}. High quality, commercial style, detailed, vibrant colors, professional lighting, 8K resolution`;

      console.log("Generating image with prompt:", prompt);

      const { data, error } = await supabase.functions.invoke('generate-themed-image', {
        body: { prompt, productName }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        onImageGenerated?.(data.imageUrl);
        toast.success("Image générée avec succès !");
      } else {
        throw new Error("Aucune image retournée");
      }
    } catch (error) {
      console.error("Erreur génération:", error);
      toast.error("Erreur lors de la génération de l'image");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="bg-gradient-primary border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Génération d'Images Thématiques par IA
        </CardTitle>
        <CardDescription>
          Créez des images du produit dans différents contextes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Choisir un thème</label>
          <Select value={selectedTheme} onValueChange={setSelectedTheme}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un thème..." />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((theme) => (
                <SelectItem key={theme.value} value={theme.value}>
                  {theme.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !selectedTheme}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Générer l'Image
            </>
          )}
        </Button>

        {generatedImage && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Image générée :</p>
            <div className="relative rounded-lg overflow-hidden border-2 border-primary">
              <img 
                src={generatedImage} 
                alt={`${productName} - ${selectedTheme}`}
                className="w-full h-auto"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
