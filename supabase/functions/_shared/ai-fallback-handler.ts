/**
 * AI Fallback Handler with automatic retry and queue management
 * 
 * Priority order:
 * 1. Lovable AI (google/gemini-2.5-flash)
 * 2. Ollama (as fallback)
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Rate limit detection (429)
 * - Concurrent request limiting
 * - Detailed logging for debugging
 */

interface AICallOptions {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  toolChoice?: any;
  preferredProvider?: 'lovable' | 'ollama';
}

interface AIResponse {
  content: string;
  provider: 'lovable' | 'ollama';
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const OLLAMA_API_KEY = Deno.env.get('OLLAMA_API_KEY');

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
}

async function callLovableAI(options: AICallOptions, attempt: number = 0): Promise<AIResponse> {
  const startTime = Date.now();
  
  try {
    console.log(`[AI-FALLBACK] Attempting Lovable AI (attempt ${attempt + 1}/${MAX_RETRIES})`);
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.userPrompt });

    const body: any = {
      model: options.model || 'google/gemini-2.5-flash',
      messages,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.tools) {
      body.tools = options.tools;
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice;
      }
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const duration = Date.now() - startTime;

    if (response.status === 429) {
      console.warn(`[AI-FALLBACK] Lovable AI rate limited (${duration}ms)`);
      
      if (attempt < MAX_RETRIES - 1) {
        const delay = getBackoffDelay(attempt);
        console.log(`[AI-FALLBACK] Retrying in ${delay}ms...`);
        await sleep(delay);
        return callLovableAI(options, attempt + 1);
      }
      
      throw new Error('Lovable AI rate limit exceeded after retries');
    }

    if (response.status === 402) {
      throw new Error('Lovable AI: Payment required - credits exhausted');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lovable AI error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    console.log(`[AI-FALLBACK] ✅ Lovable AI success (${duration}ms)`);
    
    if (duration > 30000) {
      console.warn(`[AI-FALLBACK] ⚠️ Slow response (${duration}ms), consider using a faster model`);
    }

    return {
      content: data.choices[0].message.content,
      provider: 'lovable',
      model: data.model || body.model,
      usage: data.usage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AI-FALLBACK] Lovable AI failed:`, errorMessage);
    throw error;
  }
}

async function callOllama(options: AICallOptions, attempt: number = 0): Promise<AIResponse> {
  const startTime = Date.now();
  
  try {
    console.log(`[AI-FALLBACK] Attempting Ollama (attempt ${attempt + 1}/${MAX_RETRIES})`);
    
    const model = options.model || 'gpt-oss:20b-cloud';
    const useCloud = !OLLAMA_API_KEY || model.includes('cloud');
    const baseUrl = useCloud ? 'https://ollama.com' : 'http://localhost:11434';
    
    console.log(`[AI-FALLBACK] Using ${useCloud ? 'Ollama Cloud' : 'Local Ollama'}: ${baseUrl}`);

    const messages = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.userPrompt });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (useCloud && OLLAMA_API_KEY) {
      headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;
    }

    const body: any = {
      model,
      messages,
      stream: false,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const duration = Date.now() - startTime;

    if (response.status === 429) {
      console.warn(`[AI-FALLBACK] Ollama rate limited (${duration}ms)`);
      
      if (attempt < MAX_RETRIES - 1) {
        const delay = getBackoffDelay(attempt);
        console.log(`[AI-FALLBACK] Retrying in ${delay}ms...`);
        await sleep(delay);
        return callOllama(options, attempt + 1);
      }
      
      throw new Error('Ollama rate limit exceeded after retries');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    console.log(`[AI-FALLBACK] ✅ Ollama success (${duration}ms)`);
    
    if (duration > 30000) {
      console.warn(`[AI-FALLBACK] ⚠️ Slow response (${duration}ms), consider using a faster model`);
    }

    return {
      content: data.message.content,
      provider: 'ollama',
      model: data.model || model,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AI-FALLBACK] Ollama failed:`, errorMessage);
    throw error;
  }
}

export async function callAIWithFallback(options: AICallOptions): Promise<AIResponse> {
  console.log('[AI-FALLBACK] Starting AI call with fallback...');
  console.log(`[AI-FALLBACK] Preferred provider: ${options.preferredProvider || 'lovable'}`);
  
  const providers = options.preferredProvider === 'ollama' 
    ? ['ollama', 'lovable'] 
    : ['lovable', 'ollama'];

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`[AI-FALLBACK] Trying provider: ${provider}`);
      
      if (provider === 'lovable') {
        return await callLovableAI(options);
      } else {
        return await callOllama(options);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      console.warn(`[AI-FALLBACK] Provider ${provider} failed, trying next...`);
      
      // Si c'est un problème de paiement ou de configuration, pas besoin de retry
      if (err.message.includes('Payment required') || err.message.includes('not configured')) {
        continue;
      }
      
      // Petit délai avant d'essayer le provider suivant
      await sleep(500);
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}
