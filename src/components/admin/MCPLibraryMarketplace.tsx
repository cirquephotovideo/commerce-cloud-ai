import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Package, BookOpen, ExternalLink } from "lucide-react";
import { MCP_LIBRARIES, MCPLibrary, getCategoryColor, getCategoryLabel } from "@/lib/mcpLibraries";
import { MCPInstallDialog } from "./MCPInstallDialog";

export function MCPLibraryMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLibrary, setSelectedLibrary] = useState<MCPLibrary | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);

  const { data: installedPlatforms, refetch } = useQuery({
    queryKey: ['installed-mcp-platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_configurations')
        .select('platform_type, is_active');
      
      if (error) throw error;
      return data;
    }
  });

  const isInstalled = (libraryId: string) => {
    return installedPlatforms?.some(p => p.platform_type === libraryId);
  };

  const filteredLibraries = MCP_LIBRARIES.filter(lib => {
    const matchesSearch = lib.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lib.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lib.npmPackage.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || lib.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: MCP_LIBRARIES.length,
    installed: installedPlatforms?.length || 0,
    available: MCP_LIBRARIES.length - (installedPlatforms?.length || 0)
  };

  const handleInstall = (library: MCPLibrary) => {
    setSelectedLibrary(library);
    setInstallDialogOpen(true);
  };

  const handleInstallComplete = () => {
    refetch();
    toast.success("Service MCP installé avec succès !");
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Librairies MCP</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Installés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.installed}</div>
            <p className="text-xs text-muted-foreground">Services actifs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.available}</div>
            <p className="text-xs text-muted-foreground">À installer</p>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Marketplace MCP
          </CardTitle>
          <CardDescription>
            Explorez et installez des librairies MCP pour étendre les fonctionnalités
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une librairie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="official">Officiel</TabsTrigger>
              <TabsTrigger value="integration">Intégrations</TabsTrigger>
              <TabsTrigger value="productivity">Productivité</TabsTrigger>
              <TabsTrigger value="developer">Développeur</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Grille de librairies */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredLibraries.map((library) => {
          const installed = isInstalled(library.id);
          
          return (
            <Card key={library.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{library.icon}</div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{library.name}</CardTitle>
                      <code className="text-xs text-muted-foreground">{library.npmPackage}</code>
                    </div>
                  </div>
                  <Badge variant={installed ? "default" : "secondary"}>
                    {installed ? "✓ Installé" : "Disponible"}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {library.description}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getCategoryColor(library.category)}>
                    {getCategoryLabel(library.category)}
                  </Badge>
                  <Badge variant="outline">v{library.version}</Badge>
                </div>
                
                {library.requiredEnvVars.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold">Requis:</span>{' '}
                    {library.requiredEnvVars.join(', ')}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleInstall(library)}
                    disabled={installed}
                  >
                    {installed ? "Configuré" : "Installer"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open(library.documentation, '_blank')}
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredLibraries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune librairie trouvée</p>
          </CardContent>
        </Card>
      )}

      <MCPInstallDialog
        library={selectedLibrary}
        open={installDialogOpen}
        onOpenChange={setInstallDialogOpen}
        onInstallComplete={handleInstallComplete}
      />
    </div>
  );
}
