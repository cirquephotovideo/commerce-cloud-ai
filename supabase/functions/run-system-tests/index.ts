import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleError, ErrorCode } from '../_shared/error-handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  suite: string;
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface TestSuiteConfig {
  edgeFunctions: string[];
  businessLogic: string[];
  userFlows: string[];
  security: string[];
  performance: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('unauthorized');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('unauthorized');
    }

    // Verify super admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (!roleData) {
      throw new Error('forbidden');
    }

    const { suites } = await req.json();
    const executionId = crypto.randomUUID();
    const results: TestResult[] = [];
    const startTime = Date.now();

    console.log(`[run-system-tests] Starting test execution ${executionId} for suites:`, suites);

    // Define test suites configuration
    const testConfig: TestSuiteConfig = {
      edgeFunctions: [
        'product-analyzer',
        'amazon-product-enrichment',
        'export-to-odoo',
        'export-to-prestashop',
        'supplier-import-csv',
        'check-subscription',
        'ai-chat',
        'mcp-proxy',
        'dual-search-engine',
        'google-shopping-scraper'
      ],
      businessLogic: [
        'supplier-import-csv',
        'supplier-import-xlsx',
        'amazon-product-enrichment',
        'export-to-odoo',
        'product-analyzer'
      ],
      userFlows: [
        'check-subscription'
      ],
      security: [
        'rls-policies-test',
        'token-validation-test'
      ],
      performance: [
        'latency-test'
      ]
    };

    // Run tests for each requested suite
    for (const suite of suites || ['edgeFunctions']) {
      const testsToRun = testConfig[suite as keyof TestSuiteConfig] || [];
      
      for (const testName of testsToRun) {
        const testStart = Date.now();
        let testResult: TestResult;

        try {
          if (suite === 'edgeFunctions') {
            // Test edge function availability
            const { error } = await supabase.functions.invoke(testName, {
              body: { testMode: true }
            });

            testResult = {
              suite,
              name: testName,
              status: error ? 'fail' : 'pass',
              duration: Date.now() - testStart,
              error: error?.message,
              metadata: { type: 'edge_function' }
            };
          } else {
            // For other test types, mark as skip for now
            testResult = {
              suite,
              name: testName,
              status: 'skip',
              duration: Date.now() - testStart,
              metadata: { reason: 'Not implemented yet' }
            };
          }
        } catch (error) {
          testResult = {
            suite,
            name: testName,
            status: 'fail',
            duration: Date.now() - testStart,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        results.push(testResult);

        // Store test result in database
        await supabase.from('test_execution_history').insert({
          execution_id: executionId,
          test_suite: suite,
          test_name: testName,
          status: testResult.status,
          duration_ms: testResult.duration,
          error_message: testResult.error,
          metadata: testResult.metadata,
          executed_by: user.id
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const skipCount = results.filter(r => r.status === 'skip').length;
    const totalCount = results.length;
    const healthScore = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

    console.log(`[run-system-tests] Execution ${executionId} completed:`, {
      total: totalCount,
      passed: passCount,
      failed: failCount,
      skipped: skipCount,
      healthScore,
      duration: totalDuration
    });

    // Store summary in system_health_logs
    await supabase.from('system_health_logs').insert({
      test_type: 'system_tests',
      component_name: 'run-system-tests',
      status: healthScore >= 80 ? 'operational' : healthScore >= 50 ? 'warning' : 'failing',
      test_result: {
        execution_id: executionId,
        total: totalCount,
        passed: passCount,
        failed: failCount,
        skipped: skipCount,
        health_score: healthScore,
        duration: totalDuration,
        suites
      }
    });

    return new Response(
      JSON.stringify({
        execution_id: executionId,
        results,
        summary: {
          total: totalCount,
          passed: passCount,
          failed: failCount,
          skipped: skipCount,
          health_score: healthScore,
          duration: totalDuration
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return handleError(error, 'run-system-tests', corsHeaders);
  }
});
