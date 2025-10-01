import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ImageIcon, 
  Palette, 
  Camera, 
  Lightbulb, 
  Monitor, 
  Sparkles,
  ExternalLink,
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImageOptimizationProps {
  data: {
    quality_score?: number;
    suggested_angles?: string[];
    background_recommendations?: string;
    lighting_suggestions?: string;
    composition_tips?: string;
    recommended_colors?: string[];
    photography_style?: string;
    technical_specs?: {
      min_resolution?: string;
      recommended_format?: string;
      compression_level?: string;
    };
    ai_generation_prompts?: string[];
    recommendations?: string[];
  };
}

export const ImageOptimization = ({ data }: ImageOptimizationProps) => {
  const [generatingImage, setGeneratingImage] = useState<number | null>(null);
  const [generatedImages, setGeneratedImages] = useState<{ [key: number]: string }>({});

  const generateImage = async (prompt: string, index: number) => {
    setGeneratingImage(index);
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt }
      });

      if (error) throw error;

      if (result?.image) {
        setGeneratedImages(prev => ({ ...prev, [index]: result.image }));
        toast.success("Image générée avec succès!");
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error("Erreur lors de la génération de l'image");
    } finally {
      setGeneratingImage(null);
    }
  };

  const imageTools = [
    { name: "Canva", url: "https://www.canva.com", icon: Palette },
    { name: "Unsplash", url: "https://unsplash.com", icon: Camera },
    { name: "Remove.bg", url: "https://remove.bg", icon: ImageIcon },
    { name: "TinyPNG", url: "https://tinypng.com", icon: Download }
  ];

  return (
    <Card className="bg-card border-border backdrop-blur-sm shadow-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold">Optimisation Image</h3>
          {data.quality_score && (
            <div className="flex items-center gap-2 mt-1">
              <Progress value={data.quality_score} className="h-2" />
              <span className="text-sm font-semibold">{data.quality_score}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {/* Suggested Angles */}
        {data.suggested_angles && data.suggested_angles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Angles suggérés:</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {data.suggested_angles.map((angle: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="justify-center py-2">
                  {angle}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* AI Generation Prompts */}
        {data.ai_generation_prompts && data.ai_generation_prompts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Exemples générés par IA:</p>
            </div>
            <div className="space-y-4">
              {data.ai_generation_prompts.map((prompt: string, idx: number) => (
                <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground italic">{prompt}</p>
                  {generatedImages[idx] ? (
                    <img 
                      src={generatedImages[idx]} 
                      alt={`Generated example ${idx + 1}`}
                      className="w-full rounded-lg"
                    />
                  ) : (
                    <Button 
                      onClick={() => generateImage(prompt, idx)}
                      disabled={generatingImage !== null}
                      size="sm"
                      className="w-full"
                    >
                      {generatingImage === idx ? (
                        <>
                          <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                          Génération...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Générer cet exemple
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Colors */}
        {data.recommended_colors && data.recommended_colors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Couleurs recommandées:</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {data.recommended_colors.map((color: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <div 
                    className="w-6 h-6 rounded border border-border" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-mono">{color}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Background Recommendations */}
          {data.background_recommendations && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Fond:</p>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{data.background_recommendations}</p>
            </div>
          )}

          {/* Lighting Suggestions */}
          {data.lighting_suggestions && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Éclairage:</p>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{data.lighting_suggestions}</p>
            </div>
          )}

          {/* Photography Style */}
          {data.photography_style && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Style:</p>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{data.photography_style}</p>
            </div>
          )}

          {/* Composition Tips */}
          {data.composition_tips && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Composition:</p>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{data.composition_tips}</p>
            </div>
          )}
        </div>

        {/* Technical Specs */}
        {data.technical_specs && (
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-semibold mb-3">Spécifications techniques:</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {data.technical_specs.min_resolution && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Résolution</p>
                  <p className="font-semibold">{data.technical_specs.min_resolution}</p>
                </div>
              )}
              {data.technical_specs.recommended_format && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Format</p>
                  <p className="font-semibold">{data.technical_specs.recommended_format}</p>
                </div>
              )}
              {data.technical_specs.compression_level && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Compression</p>
                  <p className="font-semibold">{data.technical_specs.compression_level}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image Tools */}
        <div>
          <p className="text-sm font-semibold mb-3">Outils recommandés:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {imageTools.map((tool, idx) => {
              const Icon = tool.icon;
              return (
                <a
                  key={idx}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{tool.name}</span>
                  <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Recommandations:</p>
            <ul className="space-y-1">
              {data.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};
