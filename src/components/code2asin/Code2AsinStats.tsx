import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Code2AsinStatsProps {
  stats?: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
    successRate: number;
  };
  isLoading: boolean;
}

export function Code2AsinStats({ stats, isLoading }: Code2AsinStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Pending */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            En attente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {stats?.pending.toLocaleString() || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Produits à enrichir
          </p>
        </CardContent>
      </Card>

      {/* Processing */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            En cours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {stats?.processing.toLocaleString() || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            En traitement
          </p>
        </CardContent>
      </Card>

      {/* Completed */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Complétés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {stats?.completed.toLocaleString() || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enrichissements réussis
          </p>
        </CardContent>
      </Card>

      {/* Success Rate */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            Taux de succès
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {stats?.successRate.toFixed(1) || 0}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats?.failed || 0} échecs
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
