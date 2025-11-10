import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Code2AsinStats } from "@/components/code2asin/Code2AsinStats";
import { QuickImportZone } from "@/components/code2asin/QuickImportZone";
import { PendingProductsTable } from "@/components/code2asin/PendingProductsTable";
import { ImportHistoryList } from "@/components/code2asin/ImportHistoryList";
import { FileDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function Code2AsinTracker() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Fetch statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['code2asin-stats'],
    queryFn: async () => {
      const [pending, processing, completed, failed] = await Promise.all([
        supabase
          .from('product_analyses')
          .select('id', { count: 'exact', head: true })
          .in('code2asin_enrichment_status', ['not_started']),
        supabase
          .from('product_analyses')
          .select('id', { count: 'exact', head: true })
          .eq('code2asin_enrichment_status', 'processing'),
        supabase
          .from('code2asin_enrichments')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('product_analyses')
          .select('id', { count: 'exact', head: true })
          .eq('code2asin_enrichment_status', 'failed')
      ]);

      const pendingCount = pending.count || 0;
      const processingCount = processing.count || 0;
      const completedCount = completed.count || 0;
      const failedCount = failed.count || 0;
      const totalCount = pendingCount + completedCount + failedCount;
      const successRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

      return {
        pending: pendingCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount,
        total: totalCount,
        successRate
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch pending products
  const { data: pendingProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['code2asin-pending', currentPage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_analyses')
        .select('id, ean, analysis_result, created_at, code2asin_enrichment_status, code2asin_enriched_at')
        .in('code2asin_enrichment_status', ['not_started', 'failed', 'processing'])
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch import history
  const { data: importHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['code2asin-import-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('code2asin_import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['code2asin-stats'] });
    queryClient.invalidateQueries({ queryKey: ['code2asin-pending'] });
    queryClient.invalidateQueries({ queryKey: ['code2asin-import-history'] });
    toast.success('Données actualisées');
  };

  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['code2asin-stats'] });
    queryClient.invalidateQueries({ queryKey: ['code2asin-pending'] });
    queryClient.invalidateQueries({ queryKey: ['code2asin-import-history'] });
  };

  if (statsLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Suivi Code2ASIN</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos exports et imports d'enrichissements Amazon
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button
            onClick={() => navigate('/code2asin-export')}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Nouvel export
          </Button>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <Code2AsinStats stats={stats} isLoading={statsLoading} />

      {/* Quick Import Zone */}
      <Card>
        <CardHeader>
          <CardTitle>📥 Import rapide</CardTitle>
          <CardDescription>
            Glissez-déposez votre fichier CSV enrichi depuis Code2ASIN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuickImportZone onImportComplete={handleImportComplete} />
        </CardContent>
      </Card>

      {/* Export Status */}
      <Card>
        <CardHeader>
          <CardTitle>📤 Statut des exports</CardTitle>
          <CardDescription>
            Produits en attente d'enrichissement sur Code2ASIN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Produits exportés</p>
              <p className="text-2xl font-bold">{stats?.pending || 0}</p>
            </div>
            <Badge variant="secondary" className="text-sm">
              En attente d'import
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pending Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Produits en cours</CardTitle>
          <CardDescription>
            Liste des produits exportés en attente d'enrichissement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PendingProductsTable
            products={pendingProducts || []}
            isLoading={productsLoading}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            totalItems={stats?.pending || 0}
            itemsPerPage={itemsPerPage}
          />
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>📜 Historique des imports</CardTitle>
          <CardDescription>
            Dernières opérations d'import effectuées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportHistoryList
            history={importHistory || []}
            isLoading={historyLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
