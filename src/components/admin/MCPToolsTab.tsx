import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, Users, Database, ArrowRightLeft } from "lucide-react";
import { MCPLibrary } from "@/lib/mcpLibraries";

interface MCPToolsTabProps {
  library: MCPLibrary;
}

export function MCPToolsTab({ library }: MCPToolsTabProps) {
  if (!library.tools) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun outil documenté pour cette librairie.
      </div>
    );
  }

  const getIcon = (category: string) => {
    switch (category) {
      case 'products':
        return <Package className="h-5 w-5" />;
      case 'orders':
        return <ShoppingCart className="h-5 w-5" />;
      case 'customers':
        return <Users className="h-5 w-5" />;
      case 'database':
        return <Database className="h-5 w-5" />;
      case 'migration':
        return <ArrowRightLeft className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'products':
        return 'Gestion des Produits';
      case 'orders':
        return 'Gestion des Commandes';
      case 'customers':
        return 'Gestion des Clients';
      case 'database':
        return 'Base de données';
      case 'migration':
        return 'Migration de données';
      default:
        return category;
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(library.tools).map(([category, tools]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {getIcon(category)}
              {getCategoryLabel(category)}
              <Badge variant="outline" className="ml-auto">
                {tools.length} outil{tools.length > 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tools.map((tool, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <code className="text-sm font-mono font-semibold text-primary">
                      {tool.name}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {tool.description}
                  </p>
                  <div className="bg-muted/50 rounded p-2 mt-2">
                    <p className="text-xs text-muted-foreground mb-1">Exemple :</p>
                    <code className="text-xs font-mono block whitespace-pre-wrap break-all">
                      {tool.example}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
