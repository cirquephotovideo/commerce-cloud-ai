import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { video_id, analysis_id } = await req.json();
    
    if (!video_id && !analysis_id) {
      return new Response(
        JSON.stringify({ error: 'video_id or analysis_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required', code: 'AUTH_ERROR' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', code: 'TOKEN_EXPIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get video record
    let query = supabase
      .from('product_videos')
      .select('*')
      .eq('user_id', user.id);

    if (video_id) {
      query = query.eq('video_id', video_id);
    } else {
      query = query.eq('analysis_id', analysis_id).order('created_at', { ascending: false });
    }

    const { data: videoData, error: videoError } = await query.limit(1).maybeSingle();

    if (videoError) {
      console.error('[GET-VIDEO-STATUS] Database error:', videoError);
      return new Response(
        JSON.stringify({ error: 'Database error', code: 'INTERNAL_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!videoData) {
      return new Response(
        JSON.stringify({ 
          status: 'not_found',
          error: 'No video found for this analysis',
          code: 'NOT_FOUND'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check timeout (30 minutes)
    const createdAt = new Date(videoData.created_at).getTime();
    const elapsedMinutes = (Date.now() - createdAt) / 1000 / 60;
    
    if (videoData.status === 'processing' && elapsedMinutes > 30) {
      await supabase
        .from('product_videos')
        .update({
          status: 'failed',
          error_message: 'Timeout: Plus de 30 minutes écoulées',
          completed_at: new Date().toISOString()
        })
        .eq('id', videoData.id);

      return new Response(
        JSON.stringify({
          status: 'failed',
          error: 'Timeout: Plus de 30 minutes écoulées',
          video_id: videoData.video_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return current status
    return new Response(
      JSON.stringify({
        status: videoData.status,
        video_id: videoData.video_id,
        video_url: videoData.video_url,
        thumbnail_url: videoData.thumbnail_url,
        duration: videoData.duration,
        error_message: videoData.error_message,
        created_at: videoData.created_at,
        completed_at: videoData.completed_at
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[GET-VIDEO-STATUS] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});