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

    // Get HeyGen API key from provider configs
    const { data: providerConfig } = await supabase
      .from('ai_provider_configs')
      .select('api_key_encrypted')
      .eq('provider', 'heygen')
      .eq('is_active', true)
      .single();

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
      const { data: videoData } = await supabase
        .from('product_videos')
        .select('*')
        .eq('analysis_id', analysis_id)
        .eq('user_id', user.id)
        .single();

      if (!videoData) {
        return new Response(
          JSON.stringify({ error: 'Video not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check status on HeyGen
      const statusRes = await fetch(`https://api.heygen.com/v2/video/${videoData.video_id}`, {
        headers: { 'X-Api-Key': HEYGEN_API_KEY }
      });

      const statusData = await statusRes.json();

      // Update database if completed
      if (statusData.data?.status === 'completed') {
        await supabase
          .from('product_videos')
          .update({
            status: 'completed',
            video_url: statusData.data.video_url,
            thumbnail_url: statusData.data.thumbnail_url,
            duration: statusData.data.duration,
            completed_at: new Date().toISOString()
          })
          .eq('id', videoData.id);

        await supabase
          .from('product_analyses')
          .update({
            enrichment_status: supabase.rpc('jsonb_set', {
              target: 'enrichment_status',
              path: '{heygen}',
              new_value: '"completed"'
            })
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
        
        const scriptPrompt = `Crée un script de démonstration produit de 60-90 secondes pour :

Produit: ${analysis.product_name}
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

        const aiData = await aiResponse.json();
        script = aiData.choices?.[0]?.message?.content || script;
      }

      // Create video on HeyGen
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
          width: 1920,
          height: 1080
        },
        aspect_ratio: '16:9'
      };

      if (template_id) {
        heygenPayload.template_id = template_id;
      }

      const heygenRes = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
          'X-Api-Key': HEYGEN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(heygenPayload)
      });

      if (!heygenRes.ok) {
        const errorText = await heygenRes.text();
        console.error('[HEYGEN-VIDEO] Generation failed:', errorText);
        return new Response(
          JSON.stringify({ error: `HeyGen API error: ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const heygenData = await heygenRes.json();
      const video_id = heygenData.data?.video_id;

      if (!video_id) {
        return new Response(
          JSON.stringify({ error: 'No video_id returned from HeyGen' }),
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