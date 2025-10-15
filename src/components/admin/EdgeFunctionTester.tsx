import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, PlayCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface EdgeFunction {
  name: string;
  category: 'core' | 'export' | 'ai' | 'payment' | 'marketing' | 'amazon' | 'utility';
  status: 'operational' | 'failing' | 'untested' | 'testing';
  testPayload?: any;
  error?: string;
  latency?: number;
  lovablePrompt?: string;
}

const edgeFunctions: EdgeFunction[] = [
  // Core Functions
  { 
    name: 'product-analyzer', 
    category: 'core', 
    status: 'untested',
    testPayload: {
      productInput: "https://www.amazon.fr/dp/B0CX23V2ZK",
      includeImages: true
    }
  },
  { name: 'check-subscription', category: 'core', status: 'untested' },
  { 
    name: 'advanced-product-analyzer', 
    category: 'core', 
    status: 'untested',
    testPayload: {
      productInput: "https://www.amazon.fr/dp/B0CX23V2ZK",
      inputType: "url",
      analysisTypes: ["technical", "commercial", "risk"],
      platform: "amazon"
    }
  },
  { 
    name: 'dual-search-engine', 
    category: 'core', 
    status: 'untested',
    testPayload: { 
      productName: 'MacBook Air M2',
      competitorSiteIds: [],
      maxResults: 5
    }
  },
  
  // Amazon Functions
  { name: 'amazon-product-search', category: 'amazon', status: 'untested', testPayload: { keywords: 'laptop' } },
  { name: 'amazon-product-enrichment', category: 'amazon', status: 'untested', testPayload: { asin: 'B0CX23V2ZK' } },
  { name: 'amazon-token-manager', category: 'amazon', status: 'untested' },
  
  // AI Functions
  { name: 'ai-chat', category: 'ai', status: 'untested', testPayload: { messages: [{ role: 'user', content: 'Hello' }] } },
  { name: 'ai-taxonomy-categorizer', category: 'ai', status: 'untested' },
  { name: 'claude-proxy', category: 'ai', status: 'untested' },
  { name: 'openai-proxy', category: 'ai', status: 'untested' },
  { 
    name: 'openrouter-proxy', 
    category: 'ai', 
    status: 'untested',
    testPayload: {
      action: 'chat',
      model: 'openai/gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Say "test successful" in French' }
      ],
      max_tokens: 50
    }
  },
  { name: 'ollama-proxy', category: 'ai', status: 'untested' },
  
  // Export Functions
  { name: 'export-to-odoo', category: 'export', status: 'untested' },
  { name: 'export-to-shopify', category: 'export', status: 'untested' },
  { name: 'export-to-woocommerce', category: 'export', status: 'untested' },
  { name: 'export-to-prestashop', category: 'export', status: 'untested' },
  { name: 'export-to-magento', category: 'export', status: 'untested' },
  { name: 'export-to-salesforce', category: 'export', status: 'untested' },
  { name: 'export-to-sap', category: 'export', status: 'untested' },
  { name: 'export-single-product', category: 'export', status: 'untested' },
  
  // Payment Functions
  { 
    name: 'create-checkout', 
    category: 'payment', 
    status: 'untested',
    testPayload: { 
      priceId: 'price_1SDUekIhbQ0wttwsmWzWVbMa',
      billingInterval: 'monthly' 
    }
  },
  { name: 'customer-portal', category: 'payment', status: 'untested' },
  { 
    name: 'manage-subscription', 
    category: 'payment', 
    status: 'untested',
    testPayload: { 
      newPlanId: '00000000-0000-0000-0000-000000000002',
      billingInterval: 'monthly' 
    }
  },
  
  // Marketing Functions
  { name: 'send-contact-email', category: 'marketing', status: 'untested' },
  { name: 'send-email-campaign', category: 'marketing', status: 'untested' },
  { 
    name: 'manage-newsletter', 
    category: 'marketing', 
    status: 'untested',
    testPayload: {
      action: 'subscribe',
      email: 'test@example.com',
      full_name: 'Test User'
    }
  },
  
  // Utility Functions
  { name: 'generate-image', category: 'utility', status: 'untested' },
  { name: 'generate-themed-image', category: 'utility', status: 'untested' },
  { name: 'search-product-images', category: 'utility', status: 'untested' },
  { 
    name: 'google-shopping-scraper', 
    category: 'utility', 
    status: 'untested',
    testPayload: {
      productName: 'iPhone 15 Pro',
      maxResults: 5
    }
  },
  { name: 'market-intelligence', category: 'utility', status: 'untested' },
];

export const EdgeFunctionTester = () => {
  const [functions, setFunctions] = useState<EdgeFunction[]>(edgeFunctions);
  const { toast } = useToast();

  const testFunction = async (functionName: string) => {
    const startTime = Date.now();
    
    setFunctions(prev => prev.map(f => 
      f.name === functionName ? { ...f, status: 'testing' as const } : f
    ));

    try {
      const func = functions.find(f => f.name === functionName);
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: func?.testPayload || {}
      });

      const latency = Date.now() - startTime;

      if (error) throw error;

      // Enregistrer le résultat dans la DB
      await supabase.from('system_health_logs').insert({
        test_type: 'edge_function',
        component_name: functionName,
        status: 'operational',
        test_result: data,
        latency_ms: latency,
        tested_by: (await supabase.auth.getUser()).data.user?.id
      });

      setFunctions(prev => prev.map(f => 
        f.name === functionName ? { ...f, status: 'operational' as const, latency } : f
      ));

      toast({
        title: "✅ Test réussi",
        description: `${functionName} fonctionne (${latency}ms)`,
      });
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      // Générer un prompt Lovable pour corriger l'erreur
      const lovablePrompt = generateFixPrompt(functionName, error.message);

      // Enregistrer l'erreur
      await supabase.from('system_health_logs').insert({
        test_type: 'edge_function',
        component_name: functionName,
        status: 'failing',
        error_message: error.message,
        latency_ms: latency,
        tested_by: (await supabase.auth.getUser()).data.user?.id
      });

      // Créer un issue de fix tracking
      await supabase.from('fix_tracking').insert({
        issue_id: `edge-${functionName}-${Date.now()}`,
        issue_type: 'edge_function',
        component_name: functionName,
        severity: 'high',
        description: error.message,
        lovable_prompt: lovablePrompt,
        created_by: (await supabase.auth.getUser()).data.user?.id
      });

      setFunctions(prev => prev.map(f => 
        f.name === functionName 
          ? { ...f, status: 'failing' as const, error: error.message, lovablePrompt, latency } 
          : f
      ));

      toast({
        title: "❌ Test échoué",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateFixPrompt = (functionName: string, errorMessage: string): string => {
    // Special handling for dual-search-engine
    if (functionName === 'dual-search-engine') {
      return `Fix the dual-search-engine edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Validate request has productName (required)
2. ✅ Handle empty competitorSiteIds by fetching all active sites
3. ✅ Check GOOGLE_SEARCH_API_KEY or SERPER_API_KEY configured
4. ✅ Add proper error codes (MISSING_PRODUCT_NAME, NO_COMPETITOR_SITES)
5. ✅ Log all steps with timestamps

Common issues:
- Missing productName → Return 400 with clear message
- No competitor sites → Fetch all active ones automatically
- API errors → Log full response with timestamps`;
    }
    
    // Special handling for manage-newsletter
    if (functionName === 'manage-newsletter') {
      return `Fix the manage-newsletter edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Validate action is 'subscribe' or 'unsubscribe'
2. ✅ Validate email format with regex
3. ✅ Normalize email (trim + lowercase)
4. ✅ Add proper error codes (INVALID_ACTION, INVALID_EMAIL)
5. ✅ Log successful operations

Common issues:
- Invalid email format → Use EMAIL_REGEX validation
- Invalid action → Check against ['subscribe', 'unsubscribe']
- Database errors → Wrap in try/catch with detailed logs`;
    }
    
    // Special handling for google-shopping-scraper
    if (functionName === 'google-shopping-scraper') {
      return `Fix the google-shopping-scraper edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Validate at least one of productName OR productUrl provided
2. ✅ Check API keys before making requests
3. ✅ Add timeout protection (10s) on all fetch calls
4. ✅ Add proper error codes (MISSING_INPUT, NO_API_KEYS, API_TIMEOUT)
5. ✅ Log with provider name and timestamps

Common issues:
- Neither productName nor productUrl → Return 400 with hint
- Missing API keys → Check LOVABLE_API_KEY, GOOGLE_SEARCH_API_KEY, SERPER_API_KEY
- Timeout → Use fetchWithTimeout wrapper`;
    }
    
    // Special handling for openrouter-proxy
    if (functionName === 'openrouter-proxy') {
      return `Fix the openrouter-proxy edge function. Error: "${errorMessage}".

Checklist:
1. ✅ Verify OPENROUTER_API_KEY is configured in ai_provider_configs table
2. ✅ Validate request body has: action, model, messages[]
3. ✅ Check OpenRouter API response format (should be JSON)
4. ✅ Test with payload: { action: 'chat', model: 'openai/gpt-3.5-turbo', messages: [...] }
5. ✅ Log all errors with full details for debugging

Common issues:
- Missing API key → Check ai_provider_configs table for provider='openrouter'
- Invalid model name → Use 'openai/gpt-3.5-turbo' for testing
- Malformed messages → Must be array of {role, content}
- Rate limiting → OpenRouter API has usage limits
- 400 errors → Check request validation (model and messages required)`;
    }
    
    return `Fix the ${functionName} edge function. The error is: "${errorMessage}".

Please:
1. Check if all required environment variables are set
2. Add proper error handling and validation
3. Test the function with appropriate test data
4. Log detailed errors for debugging
5. Return graceful error messages to the client

Make sure to handle edge cases and add proper TypeScript types.`;
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "📋 Prompt copié",
      description: "Collez-le dans l'éditeur Lovable",
    });
  };

  const getStatusIcon = (status: EdgeFunction['status']) => {
    switch (status) {
      case 'operational':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failing':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'testing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      core: 'default',
      export: 'secondary',
      ai: 'outline',
      payment: 'destructive',
      marketing: 'default',
      amazon: 'secondary',
      utility: 'outline'
    };
    return colors[category] || 'default';
  };

  const groupedFunctions = functions.reduce((acc, func) => {
    if (!acc[func.category]) acc[func.category] = [];
    acc[func.category].push(func);
    return acc;
  }, {} as Record<string, EdgeFunction[]>);

  return (
    <Accordion type="single" collapsible className="w-full">
      {Object.entries(groupedFunctions).map(([category, funcs]) => (
        <AccordionItem key={category} value={category}>
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <Badge variant={getCategoryBadgeColor(category) as any}>
                {category.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {funcs.length} fonctions
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pt-2">
              {funcs.map((func) => (
                <div key={func.name} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(func.status)}
                    <div className="flex-1">
                      <div className="font-mono text-sm">{func.name}</div>
                      {func.testPayload && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Payload: <code className="text-xs">{JSON.stringify(func.testPayload)}</code>
                        </div>
                      )}
                    </div>
                    {func.latency && (
                      <Badge variant="outline" className="text-xs">
                        {func.latency}ms
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testFunction(func.name)}
                      disabled={func.status === 'testing'}
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Test
                    </Button>

                    {func.status === 'failing' && func.lovablePrompt && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => copyPrompt(func.lovablePrompt!)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Fix Prompt
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};