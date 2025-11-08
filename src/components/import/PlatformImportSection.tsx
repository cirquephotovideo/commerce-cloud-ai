import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformImportCard } from "./PlatformImportCard";
import { PlatformConfigDialog } from "./PlatformConfigDialog";
import { AutoSyncToggle } from "./AutoSyncToggle";
import { usePlatformImport } from "@/hooks/usePlatformImport";
import { Plus, Loader2 } from "lucide-react";

export const PlatformImportSection = () => {
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | undefined>();
  const [selectedConfig, setSelectedConfig] = useState<any>(undefined);
  const [importingPlatformId, setImportingPlatformId] = useState<string | null>(null);

  const { importFromPlatform } = usePlatformImport();

  // Récupérer les plateformes configurées
  const { data: platforms, isLoading } = useQuery({
    queryKey: ['platform-configurations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('platform_configurations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const handleImport = async (platformId: string) => {
    setImportingPlatformId(platformId);
    try {
      await importFromPlatform.mutateAsync(platformId);
    } finally {
      setImportingPlatformId(null);
    }
  };

  const handleConfigure = (platformId: string) => {
    const config = platforms?.find((p) => p.id === platformId);
    setSelectedPlatformId(platformId);
    setSelectedConfig(config);
    setShowConfigDialog(true);
  };

  const handleAddPlatform = () => {
    setSelectedPlatformId(undefined);
    setSelectedConfig(undefined);
    setShowConfigDialog(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                🌐 Plateformes e-commerce
              </CardTitle>
              <CardDescription>
                Importez vos produits depuis vos plateformes configurées
              </CardDescription>
            </div>
            <Button onClick={handleAddPlatform}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une plateforme
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Plateformes configurées */}
      {platforms && platforms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.map((platform) => (
            <PlatformImportCard
              key={platform.id}
              platform={platform}
              onImport={handleImport}
              onConfigure={handleConfigure}
              isImporting={importingPlatformId === platform.id}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-lg font-semibold mb-2">Aucune plateforme configurée</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ajoutez une plateforme e-commerce pour commencer à importer vos produits
            </p>
            <Button onClick={handleAddPlatform}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter votre première plateforme
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Synchronisation automatique */}
      {platforms && platforms.length > 0 && <AutoSyncToggle />}

      {/* Dialog de configuration */}
      <PlatformConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        platformId={selectedPlatformId}
        existingConfig={selectedConfig}
      />
    </div>
  );
};
