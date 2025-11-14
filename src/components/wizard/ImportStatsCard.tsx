import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Package, RefreshCw } from 'lucide-react';

interface ImportStatsCardProps {
  stats: {
    found?: number;
    imported?: number;
    matched?: number;
    errors?: number;
  };
}

export const ImportStatsCard = ({ stats }: ImportStatsCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">📊 Résumé de l'Import</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {stats.found !== undefined && (
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.found}</div>
                <div className="text-sm text-muted-foreground">Trouvés</div>
              </div>
            </div>
          )}
          
          {stats.imported !== undefined && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.imported}</div>
                <div className="text-sm text-muted-foreground">Nouveaux</div>
              </div>
            </div>
          )}
          
          {stats.matched !== undefined && (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{stats.matched}</div>
                <div className="text-sm text-muted-foreground">Mis à jour</div>
              </div>
            </div>
          )}
          
          {stats.errors !== undefined && stats.errors > 0 && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <div className="text-2xl font-bold">{stats.errors}</div>
                <div className="text-sm text-muted-foreground">Erreurs</div>
              </div>
            </div>
          )}
        </div>
        
        {(stats.imported || 0) + (stats.matched || 0) > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              ✅ Total traité avec succès : <strong>{(stats.imported || 0) + (stats.matched || 0)}</strong> produits
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
