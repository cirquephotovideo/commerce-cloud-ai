import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export async function getCachedOrFetch<T>(
  supabaseClient: ReturnType<typeof createClient>,
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttlMinutes: number = 5
): Promise<{ data: T; cached: boolean }> {
  // Try to get from cache
  const { data: cached, error: cacheError } = await supabaseClient
    .from('mcp_cache')
    .select('cache_value, expires_at')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!cacheError && cached && 'cache_value' in cached) {
    console.log(`[CACHE] HIT: ${cacheKey}`);
    return { data: cached.cache_value as T, cached: true };
  }

  // Otherwise, fetch and store
  console.log(`[CACHE] MISS: ${cacheKey}, fetching...`);
  const data = await fetchFn();

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  await supabaseClient
    .from('mcp_cache')
    .upsert({
      cache_key: cacheKey,
      cache_value: data as any,
      expires_at: expiresAt
    });

  return { data, cached: false };
}
