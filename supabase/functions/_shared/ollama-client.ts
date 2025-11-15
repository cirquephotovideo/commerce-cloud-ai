export async function callOllamaWithWebSearch({
  model = 'qwen3-coder:480b-cloud',
  messages,
  temperature = 0.4,
  maxTokens = 2000,
  systemPrompt
}: {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/ollama-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages
      ],
      options: {
        temperature,
        num_predict: maxTokens
      },
      web_search: true
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama proxy error: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Ollama call failed');
  }

  return {
    content: data.response?.response || data.response?.message?.content || '',
    provider: 'ollama'
  };
}
