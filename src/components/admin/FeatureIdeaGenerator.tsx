import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Copy, ThumbsUp } from "lucide-react";

interface FeatureIdea {
  id: string;
  title: string;
  description: string;
  category: 'optimization' | 'missing_feature' | 'ux_improvement' | 'security' | 'integration';
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: string;
  impact: string;
  lovable_prompt: string;
  votes: number;
}

  const mockIdeas: Omit<FeatureIdea, 'id' | 'votes'>[] = [
  {
    title: "Notifications en temps réel pour price_monitoring",
    description: "Utiliser Supabase Realtime pour envoyer des alertes instantanées quand le prix d'un produit surveillé change de plus de 10%.",
    category: "missing_feature",
    priority: "high",
    effort: "Medium (4-6h)",
    impact: "High - Engagement utilisateurs",
    lovable_prompt: `Implement real-time price alerts using Supabase Realtime:

1. Add a trigger on price_history table to detect significant price changes (>10%)
2. Use Supabase Realtime channels to push notifications to connected clients
3. Create a Toast notification component to display alerts
4. Add user preferences for notification thresholds
5. Store notification history in a new table

Technical steps:
- Enable Realtime on price_history table
- Create React hook useRealtimePriceAlerts()
- Add notification preferences UI in user settings
- Test with multiple concurrent users`
  },
  {
    title: "Export CSV/Excel des product_analyses",
    description: "Permettre aux utilisateurs d'exporter leurs analyses de produits au format CSV ou Excel pour archivage et reporting.",
    category: "missing_feature",
    priority: "medium",
    effort: "Low (2-3h)",
    impact: "Medium - Satisfaction utilisateurs",
    lovable_prompt: `Add CSV/Excel export functionality for product analyses:

1. Install xlsx library: npm install xlsx
2. Create ExportButton component with format selector (CSV/Excel)
3. Implement export logic:
   - Fetch all user's product_analyses
   - Transform JSON data to flat structure
   - Use xlsx to generate file
   - Trigger download
4. Add export button to History page
5. Include filters (date range, categories, etc.)

Example code structure:
- components/ExportButton.tsx
- utils/exportHelpers.ts
- Add to src/pages/History.tsx`
  },
  {
    title: "Dashboard Analytics avec graphiques",
    description: "Créer des graphiques interactifs (recharts) montrant l'évolution des analyses, des prix, et des tendances marché.",
    category: "ux_improvement",
    priority: "high",
    effort: "High (8-10h)",
    impact: "High - Valeur perçue",
    lovable_prompt: `Create comprehensive analytics dashboard:

1. Install dependencies: recharts is already installed
2. Create AnalyticsDashboard component with:
   - Line chart: Price evolution over time
   - Bar chart: Analysis count per category
   - Pie chart: Distribution of marketplaces
   - Area chart: Savings opportunities timeline
3. Fetch aggregated data from Supabase
4. Add date range picker for filtering
5. Implement real-time updates with Realtime
6. Make charts responsive and mobile-friendly

Components to create:
- src/components/analytics/AnalyticsDashboard.tsx
- src/components/analytics/PriceChart.tsx
- src/components/analytics/CategoryChart.tsx
- src/pages/Analytics.tsx (new page)
- Add route in App.tsx`
  },
  {
    title: "Batch import CSV de produits à analyser",
    description: "Importer une liste de URLs Amazon via CSV pour analyse en masse (au lieu d'une seule à la fois).",
    category: "missing_feature",
    priority: "medium",
    effort: "Medium (5-6h)",
    impact: "High - Productivité",
    lovable_prompt: `Implement CSV batch import for product URLs:

1. Create CSVImporter component with:
   - File upload (accept .csv)
   - Parse CSV using papaparse library
   - Validate URLs format
   - Show preview of parsed data
   - Queue for batch processing
2. Create edge function batch-product-import
3. Process URLs with rate limiting (avoid API blocks)
4. Show progress bar with real-time status
5. Send email when batch is complete

Steps:
- Install: npm install papaparse @types/papaparse
- Create components/CSVImporter.tsx
- Create supabase/functions/batch-product-import/index.ts
- Add to BatchAnalyzer page
- Store import jobs in database for tracking`
  },
  {
    title: "2FA pour super_admins",
    description: "Ajouter l'authentification à deux facteurs (TOTP) pour sécuriser les comptes administrateurs.",
    category: "security",
    priority: "critical",
    effort: "Medium (4-5h)",
    impact: "Critical - Sécurité",
    lovable_prompt: `Implement Two-Factor Authentication (2FA) for super_admins:

1. Use Supabase MFA APIs:
   - supabase.auth.mfa.enroll()
   - supabase.auth.mfa.challenge()
   - supabase.auth.mfa.verify()
2. Create TwoFactorSetup component:
   - Generate QR code for authenticator apps
   - Verify initial code
   - Store backup codes
3. Add 2FA verification screen after login
4. Update user_roles table to track 2FA status
5. Require 2FA for critical admin actions

Security considerations:
- Use time-based OTP (TOTP)
- Generate 10 backup codes
- Lock account after 3 failed attempts
- Log all 2FA events

Files to create:
- components/auth/TwoFactorSetup.tsx
- components/auth/TwoFactorVerify.tsx
- Update AuthPage.tsx`
  },
  {
    title: "Intégration Keepa pour historique prix Amazon",
    description: "Connecter l'API Keepa pour afficher l'historique complet des prix Amazon (graphiques sur plusieurs mois).",
    category: "integration",
    priority: "high",
    effort: "High (10-12h)",
    impact: "Very High - Valeur ajoutée",
    lovable_prompt: `Integrate Keepa API for Amazon price history:

1. Setup:
   - Get Keepa API key from https://keepa.com/#!api
   - Store API key in Supabase secrets
2. Create edge function keepa-price-history:
   - Fetch historical data for ASIN
   - Parse Keepa's compressed format
   - Store in price_history table
3. Create PriceHistoryChart component:
   - Display 30/90/365 days views
   - Show all sellers (not just buybox)
   - Highlight deals and price drops
4. Add to ProductDetailModal
5. Cache results to reduce API calls

Implementation:
- supabase/functions/keepa-price-history/index.ts
- components/market/KeepaChart.tsx
- Update ProductDetailModal with new tab
- API docs: https://keepa.com/#!api`
  },
  {
    title: "Webhook Stripe pour auto-update abonnements",
    description: "Écouter les webhooks Stripe pour mettre à jour automatiquement le statut des abonnements (au lieu de vérifier manuellement).",
    category: "optimization",
    priority: "medium",
    effort: "Medium (5-6h)",
    impact: "High - Fiabilité",
    lovable_prompt: `Setup Stripe webhooks for automatic subscription updates:

1. Create edge function stripe-webhook-handler:
   - Verify webhook signature
   - Handle events:
     * customer.subscription.created
     * customer.subscription.updated
     * customer.subscription.deleted
     * invoice.payment_succeeded
     * invoice.payment_failed
2. Update user_subscriptions table automatically
3. Send email notifications to users
4. Log all webhook events for debugging
5. Configure webhook in Stripe Dashboard

Security:
- Validate webhook signature
- Use webhook secret from env
- Idempotency keys for duplicate events
- Rate limiting

Files:
- supabase/functions/stripe-webhook-handler/index.ts
- Add webhook URL in Stripe Dashboard: https://your-project.supabase.co/functions/v1/stripe-webhook-handler
- Update config.toml with verify_jwt = false`
  },
  {
    title: "Lazy loading des tabs dans BatchAnalyzer",
    description: "Charger le contenu des tabs uniquement quand l'utilisateur clique dessus (améliore les performances initiales).",
    category: "optimization",
    priority: "low",
    effort: "Low (1-2h)",
    impact: "Medium - Performance",
    lovable_prompt: `Optimize BatchAnalyzer with lazy loading tabs:

1. Use React.lazy() for heavy tab components:
   - AIMarketSuggestions
   - CompetitiveDashboard
   - AnalysisResults
2. Wrap with Suspense for loading states
3. Only mount components when tab is active
4. Prefetch next likely tab on hover
5. Measure improvement with React DevTools Profiler

Implementation:
\`\`\`typescript
const AIMarketSuggestions = lazy(() => import('./AIMarketSuggestions'));
const CompetitiveDashboard = lazy(() => import('./CompetitiveDashboard'));

// In render:
<Suspense fallback={<Skeleton />}>
  {activeTab === 'market' && <AIMarketSuggestions />}
</Suspense>
\`\`\`

Files to modify:
- src/pages/BatchAnalyzer.tsx
- Add loading skeletons for each tab`
  }
];

export const FeatureIdeaGenerator = () => {
  const [ideas, setIdeas] = useState<FeatureIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateIdeas = async () => {
    setLoading(true);
    
    try {
      // Charger les idées existantes de la DB
      const { data: existingIdeas, error } = await supabase
        .from('feature_suggestions')
        .select('*')
        .order('votes', { ascending: false });

      if (error) throw error;

      // Si pas d'idées, insérer les mock ideas
      if (!existingIdeas || existingIdeas.length === 0) {
        const { data: userData } = await supabase.auth.getUser();
        const { error: insertError } = await supabase
          .from('feature_suggestions')
          .insert(mockIdeas.map(idea => ({
            title: idea.title,
            description: idea.description,
            category: idea.category,
            priority: idea.priority,
            effort: idea.effort,
            impact: idea.impact,
            lovable_prompt: idea.lovable_prompt,
            votes: 0,
            created_by: userData.user?.id
          })));

        if (insertError) throw insertError;

        // Recharger
        const { data: newIdeas } = await supabase
          .from('feature_suggestions')
          .select('*')
          .order('votes', { ascending: false });

        setIdeas(newIdeas || []);
      } else {
        setIdeas(existingIdeas);
      }

      toast({
        title: "💡 Idées générées",
        description: `${mockIdeas.length} suggestions de fonctionnalités`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "📋 Prompt copié",
      description: "Collez-le dans l'éditeur Lovable",
    });
  };

  const voteIdea = async (id: string) => {
    const currentVotes = ideas.find(i => i.id === id)?.votes || 0;
    const { error } = await supabase
      .from('feature_suggestions')
      .update({ votes: currentVotes + 1 })
      .eq('id', id);

    if (!error) {
      setIdeas(prev => prev.map(i => 
        i.id === id ? { ...i, votes: i.votes + 1 } : i
      ).sort((a, b) => b.votes - a.votes));
      
      toast({
        title: "👍 Vote enregistré",
      });
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      optimization: 'default',
      missing_feature: 'secondary',
      ux_improvement: 'outline',
      security: 'destructive',
      integration: 'default'
    };
    return colors[category] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: 'destructive',
      high: 'secondary',
      medium: 'outline',
      low: 'default'
    };
    return colors[priority] || 'default';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Générateur d'Idées de Fonctionnalités
          </CardTitle>
          <CardDescription>
            Suggestions intelligentes basées sur l'analyse de votre codebase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateIdeas} disabled={loading} size="lg">
            {loading ? "Génération en cours..." : "🚀 Générer des Idées"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {ideas.map((idea) => (
          <Card key={idea.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{idea.title}</CardTitle>
                  <CardDescription className="mt-2">{idea.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => voteIdea(idea.id)}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {idea.votes}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant={getCategoryColor(idea.category) as any}>
                  {idea.category.replace('_', ' ')}
                </Badge>
                <Badge variant={getPriorityColor(idea.priority) as any}>
                  Priority: {idea.priority}
                </Badge>
                <Badge variant="outline">Effort: {idea.effort}</Badge>
                <Badge variant="outline">Impact: {idea.impact}</Badge>
              </div>

              <Button
                onClick={() => copyPrompt(idea.lovable_prompt)}
                className="w-full"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copier le Prompt Lovable
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};