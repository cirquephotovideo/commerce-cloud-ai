import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { useAutomationStats } from '@/hooks/useAutomationStats';
import { Plus, Play, Pause, Trash2, BarChart3, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AutomationWizard } from './AutomationWizard';

const categoryIcons: Record<string, string> = {
  import: '📥',
  cleanup: '🧹',
  enrichment: '🚀',
  export: '📤',
  sync: '🔄',
  linking: '🔗',
};

const categoryLabels: Record<string, string> = {
  import: 'Imports Auto',
  cleanup: 'Nettoyage',
  enrichment: 'Enrichissement',
  export: 'Exports Auto',
  sync: 'Synchro',
  linking: 'Liaison Auto',
};

export const AutomationMasterManager = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [wizardOpen, setWizardOpen] = useState(false);
  const { rules, isLoading, toggleActive, deleteRule } = useAutomationRules(selectedCategory);
  const { data: stats } = useAutomationStats();

  const categoryCounts = stats?.byCategory.reduce((acc, stat) => {
    acc[stat.category] = stat;
    return acc;
  }, {} as Record<string, any>) || {};

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await toggleActive.mutateAsync({ id, isActive: !currentStatus });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) {
      await deleteRule.mutateAsync(id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.keys(categoryLabels).map((category) => {
          const stat = categoryCounts[category];
          const total = stat?.total || 0;
          const active = stat?.active || 0;
          const successRate = stat?.success_rate || 0;

          return (
            <Card
              key={category}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedCategory(category)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="text-2xl">{categoryIcons[category]}</span>
                  {categoryLabels[category]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Règles totales</span>
                    <span className="font-semibold">{total}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Actives</span>
                    <Badge variant={active > 0 ? 'default' : 'secondary'}>
                      {active}
                    </Badge>
                  </div>
                  {stat && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taux de succès</span>
                      <span className="font-semibold text-green-600">{successRate}%</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedCategory
                  ? `Règles - ${categoryLabels[selectedCategory]}`
                  : 'Toutes les règles'}
              </CardTitle>
              <CardDescription>
                Gérez vos automatisations pour l'import, le nettoyage, l'enrichissement et l'export
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {selectedCategory && (
                <Button variant="outline" onClick={() => setSelectedCategory(undefined)}>
                  Voir toutes
                </Button>
              )}
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle règle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!rules || rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucune règle d'automatisation configurée</p>
              <p className="text-sm mt-2">Créez votre première automatisation pour gagner du temps</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Règle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Déclencheur</TableHead>
                  <TableHead>Dernière exec.</TableHead>
                  <TableHead className="text-right">Statistiques</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{categoryIcons[rule.rule_category]}</span>
                        <div>
                          <div className="font-medium">{rule.rule_name}</div>
                          {rule.rule_description && (
                            <div className="text-sm text-muted-foreground">
                              {rule.rule_description}
                            </div>
                          )}
                          {rule.last_error_message && (
                            <div className="text-sm text-destructive mt-1">
                              ⚠️ {rule.last_error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? '🟢 Active' : '🔴 Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {rule.trigger_config?.frequency || rule.trigger_type}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {rule.last_triggered_at
                          ? formatDistanceToNow(new Date(rule.last_triggered_at), {
                              addSuffix: true,
                              locale: fr,
                            })
                          : 'Jamais'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1 text-sm">
                        <div className="text-green-600">✓ {rule.success_count}</div>
                        {rule.error_count > 0 && (
                          <div className="text-destructive">✗ {rule.error_count}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleActive(rule.id, rule.is_active)}
                        >
                          {rule.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost">
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Automation Wizard */}
      <AutomationWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
};
