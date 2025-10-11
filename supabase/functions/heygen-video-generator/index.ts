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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, analysis_id, avatar_id, voice_id, template_id, custom_script, auto_generate_script = true } = await req.json();

    console.log(`[HEYGEN-VIDEO] Action: ${action}, Analysis: ${analysis_id}`);
    
    // ✅ Timeout automatique rétroactif : marquer toutes les vidéos en processing > 30 min comme failed
    const { data: stuckVideos } = await supabase
      .from('product_videos')
      .select('id, video_id, created_at')
      .eq('status', 'processing')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (stuckVideos && stuckVideos.length > 0) {
      console.log(`[HEYGEN-VIDEO] Marking ${stuckVideos.length} stuck videos as failed:`, stuckVideos.map(v => v.video_id));
      await supabase
        .from('product_videos')
        .update({ 
          status: 'failed', 
          error_message: 'Timeout: Plus de 30 minutes écoulées sans réponse de HeyGen' 
        })
        .in('id', stuckVideos.map(v => v.id));
    }

    // Get HeyGen API key from provider configs (user key or global fallback)
    let providerConfig = null;
    
    const { data: userConfig } = await supabase
      .from('ai_provider_configs')
      .select('api_key_encrypted')
      .eq('provider', 'heygen')
      .eq('is_active', true)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (userConfig) {
      providerConfig = userConfig;
    } else {
      const { data: globalConfig } = await supabase
        .from('ai_provider_configs')
        .select('api_key_encrypted')
        .eq('provider', 'heygen')
        .eq('is_active', true)
        .is('user_id', null)
        .maybeSingle();
      
      providerConfig = globalConfig;
    }

    if (!providerConfig?.api_key_encrypted) {
      console.error('[HEYGEN-VIDEO] HeyGen API key not configured');
      return new Response(
        JSON.stringify({ 
          error: 'HeyGen API key not configured. Please configure your HeyGen API key in Admin > API Key Management.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const HEYGEN_API_KEY = providerConfig.api_key_encrypted;

    // Action: list resources (avatars, voices, templates)
    if (action === 'list_resources') {
      try {
        const [avatarsRes, voicesRes] = await Promise.all([
          fetch('https://api.heygen.com/v2/avatars', {
            headers: { 'X-Api-Key': HEYGEN_API_KEY }
          }),
          fetch('https://api.heygen.com/v2/voices', {
            headers: { 'X-Api-Key': HEYGEN_API_KEY }
          })
        ]);

        const avatars = await avatarsRes.json();
        const voices = await voicesRes.json();

        return new Response(
          JSON.stringify({
            avatars: avatars.data?.avatars || [],
            voices: voices.data?.voices || []
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('[HEYGEN-VIDEO] Error fetching resources:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch HeyGen resources' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Action: check video status
    if (action === 'check_status' && analysis_id) {
      const { video_id: videoIdParam } = await req.json().then(body => body).catch(() => ({}));
      console.log('[HEYGEN-VIDEO] Checking status for analysis:', analysis_id, 'video_id:', videoIdParam);
      
      // Get video record - use video_id if provided, otherwise get latest for analysis_id
      let videoQuery = supabase
        .from('product_videos')
        .select('*')
        .eq('user_id', user.id);

      if (videoIdParam) {
        videoQuery = videoQuery.eq('video_id', videoIdParam);
      } else {
        videoQuery = videoQuery.eq('analysis_id', analysis_id).order('created_at', { ascending: false });
      }

      const { data: videoData, error: videoError } = await videoQuery.limit(1).maybeSingle();

      if (videoError) {
        console.error('[HEYGEN-VIDEO] Database error fetching video:', videoError);
        return new Response(
          JSON.stringify({ error: 'Database error while fetching video' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!videoData) {
        console.warn('[HEYGEN-VIDEO] Video not found for', videoIdParam ? `video_id: ${videoIdParam}` : `analysis_id: ${analysis_id}`);
        return new Response(
          JSON.stringify({ error: 'Video not found for analysis/video id' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ✅ Timeout automatique backend après 30 minutes
      const createdAt = new Date(videoData.created_at).getTime();
      const elapsedMinutes = (Date.now() - createdAt) / 1000 / 60;
      
      if (videoData.status === 'processing' && elapsedMinutes > 30) {
        console.warn(`[HEYGEN-VIDEO] Backend timeout for video ${videoData.video_id} (${Math.floor(elapsedMinutes)} minutes)`);
        
        await supabase
          .from('product_videos')
          .update({
            status: 'failed',
            error_message: 'Timeout backend: Plus de 30 minutes écoulées sans réponse de HeyGen',
            completed_at: new Date().toISOString()
          })
          .eq('id', videoData.id);

        return new Response(
          JSON.stringify({
            status: 'failed',
            error: 'Timeout backend: Plus de 30 minutes écoulées'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check status on HeyGen - Correct API endpoint
      // Check status on HeyGen with automatic fallback between v2 and v1 endpoints
      console.log(`[HEYGEN-VIDEO] Checking status for video: ${videoData.video_id}`);

      const statusUrlV2 = `https://api.heygen.com/v2/video/status?video_id=${videoData.video_id}`;
      let statusRes = await fetch(statusUrlV2, {
        headers: { 'X-Api-Key': HEYGEN_API_KEY }
      });

      // If v2 returns 404, try legacy v1 endpoint
      if (!statusRes.ok && statusRes.status === 404) {
        const statusUrlV1 = `https://api.heygen.com/v1/video_status.get?video_id=${videoData.video_id}`;
        console.warn('[HEYGEN-VIDEO] v2 status 404, trying v1 endpoint:', statusUrlV1);
        const fallbackRes = await fetch(statusUrlV1, {
          headers: { 'X-Api-Key': HEYGEN_API_KEY }
        });
        
        if (fallbackRes.ok) {
          const v1Data = await fallbackRes.json();
          
          // ✅ CORRECTION: Mettre à jour la DB si le statut est 'completed'
          if (v1Data.data?.status === 'completed') {
            console.log('[HEYGEN-VIDEO] v1 API returned completed status, updating database');
            await supabase
              .from('product_videos')
              .update({
                status: 'completed',
                video_url: v1Data.data.video_url,
                thumbnail_url: v1Data.data.thumbnail_url,
                duration: v1Data.data.duration,
                error_message: null,
                completed_at: new Date().toISOString()
              })
              .eq('id', videoData.id);
          }
          
          return new Response(
            JSON.stringify(v1Data.data),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const fbText = await fallbackRes.text();
          console.error('[HEYGEN-VIDEO] v1 status check failed:', fallbackRes.status, fbText);
          return new Response(
            JSON.stringify({
              error: `Failed to check video status (v1): ${fallbackRes.status}`,
              details: fbText.substring(0, 300)
            }),
            { status: fallbackRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (!statusRes.ok) {
        const errorText = await statusRes.text();
        console.error('[HEYGEN-VIDEO] Status check failed:', statusRes.status, errorText);
        return new Response(
          JSON.stringify({ 
            error: `Failed to check video status: ${statusRes.status}`,
            details: errorText.substring(0, 300)
          }),
          { status: statusRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let statusData: any;
      try {
        statusData = await statusRes.json();
      } catch (parseError) {
        const responseText = await statusRes.text();
        console.error('[HEYGEN-VIDEO] Failed to parse JSON:', responseText.substring(0, 300));
        return new Response(
          JSON.stringify({ 
            error: 'Invalid response from HeyGen API',
            details: 'Response was not valid JSON'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update database if completed
      if (statusData.data?.status === 'completed') {
        await supabase
          .from('product_videos')
          .update({
            status: 'completed',
            video_url: statusData.data.video_url,
            thumbnail_url: statusData.data.thumbnail_url,
            duration: statusData.data.duration,
            error_message: null,
            completed_at: new Date().toISOString()
          })
          .eq('id', videoData.id);

        // Get current analysis to merge enrichment_status
        const { data: currentAnalysis } = await supabase
          .from('product_analyses')
          .select('enrichment_status, analysis_result')
          .eq('id', analysis_id)
          .single();

        await supabase
          .from('product_analyses')
          .update({
            enrichment_status: {
              ...(currentAnalysis?.enrichment_status || {}),
              heygen: 'completed'
            },
            analysis_result: {
              ...(currentAnalysis?.analysis_result || {}),
              heygen_video_url: statusData.data.video_url,
              heygen_thumbnail_url: statusData.data.thumbnail_url
            }
          })
          .eq('id', analysis_id);
      }

      return new Response(
        JSON.stringify(statusData.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: generate video
    if (action === 'generate') {
      // Validation des paramètres obligatoires
      if (!analysis_id) {
        return new Response(
          JSON.stringify({ error: 'analysis_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!avatar_id || !voice_id) {
        return new Response(
          JSON.stringify({ 
            error: 'avatar_id and voice_id are required for video generation. Please select an avatar and voice using the wizard.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get product data
      const { data: analysis } = await supabase
        .from('product_analyses')
        .select('*')
        .eq('id', analysis_id)
        .eq('user_id', user.id)
        .single();

      if (!analysis) {
        return new Response(
          JSON.stringify({ error: 'Analysis not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate script if needed
      let script = custom_script || analysis.description || '';

      if (auto_generate_script && !custom_script) {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        
        // Get product name with fallbacks
        const productName = analysis.product_name || 
                           analysis.analysis_result?.title || 
                           analysis.analysis_result?.product_name || 
                           'ce produit';
        
        const scriptPrompt = `Crée un script de démonstration produit de 60-90 secondes pour :

Produit: ${productName}
Description: ${analysis.description || ''}
Points clés: ${analysis.key_features?.slice(0, 5).join(', ') || 'N/A'}

Le script doit :
- Être conversationnel et dynamique
- Mettre en avant 3-4 bénéfices clés du produit
- Inclure un appel à l'action
- Durée : 60-90 secondes à l'oral
- Format : paragraphes courts adaptés pour un avatar IA

Retourne UNIQUEMENT le script, sans introduction ni conclusion.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Tu es un expert en marketing produit. Retourne uniquement le script demandé.' },
              { role: 'user', content: scriptPrompt }
            ]
          })
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('[HEYGEN-VIDEO] AI script generation error:', aiResponse.status, errorText);
          throw new Error(`AI API error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        script = aiData.choices?.[0]?.message?.content || script;
        console.log('[HEYGEN-VIDEO] Script generated successfully for product:', productName);
      }

      // Create video on HeyGen (HD 720p resolution for free plan compatibility)
      console.log('[HEYGEN-VIDEO] Using resolution: 1280x720 (HD 720p)');
      const heygenPayload: any = {
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: avatar_id,
            avatar_style: 'normal'
          },
          voice: {
            type: 'text',
            input_text: script,
            voice_id: voice_id
          }
        }],
        dimension: {
          width: 1280,
          height: 720
        },
        aspect_ratio: '16:9'
      };

      if (template_id) {
        heygenPayload.template_id = template_id;
      }

      console.log('[HEYGEN] Request payload:', JSON.stringify(heygenPayload, null, 2));

      const heygenRes = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(heygenPayload)
      });

      console.log('[HEYGEN] Response status:', heygenRes.status);

      if (!heygenRes.ok) {
        const rawText = await heygenRes.text();
        console.error('[HEYGEN] Error response body:', rawText);
        let parsed: any = null;
        try { parsed = JSON.parse(rawText); } catch {}
        const status = heygenRes.status;
        const message = parsed?.message || parsed?.error || rawText?.slice(0, 300) || 'HeyGen API error';
        console.error('[HEYGEN-VIDEO] Generation failed:', status, message);
        
        // Enhanced error messages based on status codes
        let userMessage = message;
        if (status === 402) {
          userMessage = '💳 Crédits insuffisants pour générer une vidéo. Veuillez recharger votre compte HeyGen.';
        } else if (status === 429) {
          userMessage = '⏱️ Limite de génération atteinte. Réessayez dans quelques minutes.';
        } else if (status === 401 || status === 403) {
          userMessage = '🔑 Clé API HeyGen invalide ou expirée. Contactez l\'administrateur.';
        }
        
        return new Response(
          JSON.stringify({ error: userMessage, status, details: parsed || undefined }),
          { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const heygenData = await heygenRes.json();
      console.log('[HEYGEN-VIDEO] HeyGen generate response:', JSON.stringify(heygenData, null, 2));
      
      const video_id = heygenData.data?.video_id;
      console.log('[HEYGEN-VIDEO] Generated video_id:', video_id);

      if (!video_id) {
        console.error('[HEYGEN-VIDEO] No video_id in response:', heygenData);
        return new Response(
          JSON.stringify({ error: 'No video_id returned from HeyGen', response: heygenData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Save to database
      const { data: videoRecord, error: insertError } = await supabase
        .from('product_videos')
        .insert({
          analysis_id,
          user_id: user.id,
          video_id,
          status: 'processing',
          template_id: template_id || null,
          avatar_id,
          voice_id,
          script
        })
        .select()
        .single();

      if (insertError) {
        console.error('[HEYGEN-VIDEO] Database insert error:', insertError);
        throw insertError;
      }

      // Update product_analyses
      await supabase
        .from('product_analyses')
        .update({
          heygen_video_id: videoRecord.id,
          enrichment_status: {
            ...(analysis.enrichment_status || {}),
            heygen: 'processing'
          }
        })
        .eq('id', analysis_id);

      console.log('[HEYGEN-VIDEO] Video generation started:', video_id);

      return new Response(
        JSON.stringify({
          success: true,
          video_id,
          record_id: videoRecord.id,
          status: 'processing'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HEYGEN-VIDEO] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});