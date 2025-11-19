import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertCircle, Download, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ImportError {
  chunk: number;
  message: string;
  retry_count: number;
}

interface ImportReportData {
  job_id: string;
  supplier_name: string;
  total_rows: number;
  processed_rows: number;
  matched: number;
  new_products: number;
  failed: number;
  links_created: number;
  unlinked_products: number;
  duration_minutes: number;
  chunks_failed: number;
  status: 'completed' | 'partial' | 'failed';
  errors: ImportError[];
}

interface ImportReportProps {
  open: boolean;
  onClose: () => void;
  data: ImportReportData | null;
}

export function ImportReport({ open, onClose, data }: ImportReportProps) {
  const navigate = useNavigate();

  if (!data) return null;

  const successRate = data.total_rows > 0 
    ? Math.round(((data.new_products + data.matched) / data.total_rows) * 100)
    : 0;

  const linkingRate = (data.links_created + data.unlinked_products) > 0
    ? Math.round((data.links_created / (data.links_created + data.unlinked_products)) * 100)
    : 0;

  const downloadReport = () => {
    const csv = [
      ['Rapport d\'Import'],
      ['Fournisseur', data.supplier_name],
      ['Date', new Date().toLocaleDateString('fr-FR')],
      ['Durée', `${data.duration_minutes} minutes`],
      [''],
      ['Statistiques'],
      ['Lignes totales', data.total_rows],
      ['Lignes traitées', data.processed_rows],
      ['Nouveaux produits', data.new_products],
      ['Produits mis à jour', data.matched],
      ['Échecs', data.failed],
      [''],
      ['Liaison Automatique'],
      ['Produits liés', data.links_created],
      ['Produits non liés', data.unlinked_products],
      ['Taux de liaison', `${linkingRate}%`],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-import-${data.supplier_name}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {data.status === 'partial' && <AlertCircle className="h-5 w-5 text-orange-600" />}
            {data.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" />}
            Rapport d'Import - {data.supplier_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Banner */}
          <Alert variant={data.status === 'completed' ? 'default' : 'destructive'}>
            <AlertDescription>
              {data.status === 'completed' && `✅ Import complété avec succès en ${data.duration_minutes} minutes`}
              {data.status === 'partial' && `⚠️ Import partiel: ${data.processed_rows}/${data.total_rows} lignes traitées`}
              {data.status === 'failed' && `❌ Import échoué après ${data.duration_minutes} minutes`}
            </AlertDescription>
          </Alert>

          {/* Main Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Lignes traitées</div>
                  <div className="text-2xl font-bold">{data.processed_rows}/{data.total_rows}</div>
                  <Progress value={(data.processed_rows / data.total_rows) * 100} className="mt-2" />
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-sm text-muted-foreground">Nouveaux</div>
                  <div className="text-2xl font-bold text-green-600">{data.new_products}</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-sm text-muted-foreground">Mis à jour</div>
                  <div className="text-2xl font-bold text-blue-600">{data.matched}</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-sm text-muted-foreground">Échecs</div>
                  <div className="text-2xl font-bold text-red-600">{data.failed}</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Taux de réussite</div>
                <Progress value={successRate} className="mt-2" />
                <div className="text-right text-sm font-medium mt-1">{successRate}%</div>
              </div>
            </CardContent>
          </Card>

          {/* Linking Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>🔗 Liaison Automatique</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-sm text-muted-foreground">Produits liés</div>
                  <div className="text-2xl font-bold text-green-600">{data.links_created}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Associés automatiquement au catalogue
                  </div>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="text-sm text-muted-foreground">Produits non liés</div>
                  <div className="text-2xl font-bold text-orange-600">{data.unlinked_products}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Nécessitent une liaison manuelle
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Taux de liaison</div>
                <Progress value={linkingRate} className="mt-2" />
                <div className="text-right text-sm font-medium mt-1">{linkingRate}%</div>
              </div>

              {data.unlinked_products > 0 && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {data.unlinked_products} produits n'ont pas pu être liés automatiquement.
                    <Button 
                      variant="link" 
                      className="ml-2 p-0 h-auto"
                      onClick={() => {
                        navigate('/suppliers');
                        onClose();
                      }}
                    >
                      Voir les produits fournisseurs →
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Technical Details / Debug Section */}
          <Card>
            <CardHeader>
              <CardTitle>🔍 Détails Techniques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground">Job ID:</span>
                  <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">{data.job_id}</code>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Linking Status:</span>
                  <div className="ml-2">
                    {data.links_created > 0 ? (
                      <span className="text-green-600 font-semibold">✓ Actif</span>
                    ) : (
                      <span className="text-red-600 font-semibold">✗ Jamais exécuté</span>
                    )}
                  </div>
                </div>
              </div>
              
              {data.links_created === 0 && data.new_products > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    ⚠️ Linking automatique n'a pas fonctionné pour cet import.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Errors Table */}
          {data.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>⚠️ Erreurs ({data.errors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chunk</TableHead>
                      <TableHead>Ligne approximative</TableHead>
                      <TableHead>Tentatives</TableHead>
                      <TableHead>Erreur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.errors.map((err, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{err.chunk + 1}</TableCell>
                        <TableCell>{err.chunk * 100} - {(err.chunk + 1) * 100}</TableCell>
                        <TableCell>{err.retry_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={downloadReport}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger le rapport
            </Button>
            {data.unlinked_products > 0 && (
              <Button onClick={() => {
                navigate('/suppliers');
                onClose();
              }}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Lier les produits
              </Button>
            )}
            <Button onClick={onClose}>Fermer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
