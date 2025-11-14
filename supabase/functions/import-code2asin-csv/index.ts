// @ts-ignore - Deno edge function compatibility
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 1000;
const CHUNK_STAGGER_MS = 250;

interface Code2AsinRow {
  ASIN?: string;
  Titre?: string;
  EAN?: string;
  UPC?: string;
  'Numéro de pièce'?: string;
  'Prix Buy Box Nouvelle (€)'?: string;
  'Prix Amazon (€)'?: string;
  "Prix le plus bas FBA en 'Neuf' (€)"?: string;
  "Prix le plus bas en 'Neuf' (€)"?: string;
  "Prix le plus bas en 'D'occasion' (€)"?: string;
  'Prix de liste (€)'?: string;
  Marque?: string;
  Fabricant?: string;
  Images?: string;
  "Longueur de l'article (cm)"?: string;
  "Largeur de l'article (cm)"?: string;
  "Hauteur de l'article (cm)"?: string;
  "Poids de l'article (g)"?: string;
  "Longueur du paquet (cm)"?: string;
  "Largeur du paquet (cm)"?: string;
  "Hauteur du paquet (cm)"?: string;
  "Poids de l'emballage (g)"?: string;
  "Nombre d'offres en 'Neuf'"?: string;
  "Nombre d'offres en 'D'occasion'"?: string;
  'Pourcentage de commission de référence'?: string;
  "Frais de préparation et d'emballage (€)"?: string;
  'Rangs de vente'?: string;
  Couleur?: string;
  Taille?: string;
  Fonctionnalités?: string;
  Marché?: string;
  'Groupe de produits'?: string;
  Type?: string;
  'Parcourir les nœuds'?: string;
  "Nom du vendeur dans l'offre Buy Box Nouvelle"?: string;
  "La Buy Box Nouvelle est-elle gérée par Amazon ?"?: string;
  "La Buy Box Nouvelle est-elle d'Amazon ?"?: string;
  [key: string]: string | undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath, options } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) {
      throw new Error('Unauthorized');
    }
    
    console.log(`[ORCHESTRATOR] Starting Code2ASIN import orchestration for user ${user.id}`);
    console.log(`[ORCHESTRATOR] File: ${filePath}`);
    
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('supplier-imports')
      .download(filePath);

    if (downloadError) {
      console.error('[ORCHESTRATOR] Storage download error:', downloadError);
      throw new Error(`Échec du téléchargement: ${downloadError.message}`);
    }

    const csvText = await fileData.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    if (!headers.includes('EAN')) {
      throw new Error('La colonne EAN est obligatoire dans le fichier CSV');
    }

    const totalRows = lines.length - 1;
    console.log(`[ORCHESTRATOR] Total rows to process: ${totalRows}`);

    const { data: job, error: jobError } = await supabaseClient
      .from('code2asin_import_jobs')
      .insert({
        user_id: user.id,
        filename: filePath.split('/').pop(),
        status: 'processing',
        total_rows: totalRows,
        processed_rows: 0,
        success_count: 0,
        failed_count: 0,
        created_count: 0,
        updated_count: 0
      })
      .select()
      .maybeSingle();

    if (jobError) {
      console.error('[ORCHESTRATOR] Failed to create job:', jobError);
      throw new Error(`Échec de la création du job: ${jobError.message || jobError.toString()}`);
    }

    if (!job) {
      console.error('[ORCHESTRATOR] Job creation returned no data');
      throw new Error('Échec de la création du job: Aucune donnée retournée');
    }

    const jobId = job.id;
    console.log(`[ORCHESTRATOR] Created job ${jobId}`);

    const chunkCount = Math.ceil(totalRows / CHUNK_SIZE);
    console.log(`[ORCHESTRATOR] Creating ${chunkCount} chunks (size=${CHUNK_SIZE})`);

    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
      const startRow = i * CHUNK_SIZE + 1;
      const endRow = Math.min((i + 1) * CHUNK_SIZE, totalRows);
      
      chunks.push({
        job_id: jobId,
        chunk_index: i,
        start_row: startRow,
        end_row: endRow,
        status: 'pending',
        processed_rows: 0,
        retry_count: 0
      });
    }

    const { error: chunksError } = await supabaseClient
      .from('code2asin_import_chunks')
      .insert(chunks);

    if (chunksError) {
      console.error('[ORCHESTRATOR] Failed to create chunks:', chunksError);
      throw new Error('Échec de la création des chunks');
    }

    console.log(`[ORCHESTRATOR] Created ${chunkCount} chunk records`);

    const { data: createdChunks, error: fetchError } = await supabaseClient
      .from('code2asin_import_chunks')
      .select('*')
      .eq('job_id', jobId)
      .order('chunk_index');

    if (fetchError || !createdChunks) {
      console.error('[ORCHESTRATOR] Failed to fetch chunks:', fetchError);
      throw new Error('Échec de la récupération des chunks');
    }

    console.log('[ORCHESTRATOR] Starting background chunk processing...');
    
    const launchChunks = async () => {
      for (let i = 0; i < createdChunks.length; i++) {
        const chunk = createdChunks[i];
        
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, CHUNK_STAGGER_MS));
        }
        
        console.log(`[ORCHESTRATOR] Launching chunk ${chunk.chunk_index} (rows ${chunk.start_row}-${chunk.end_row})`);
        
        supabaseClient.functions.invoke('process-code2asin-chunk', {
          body: {
            jobId: jobId,
            chunkId: chunk.id,
            filePath: filePath,
            startRow: chunk.start_row,
            endRow: chunk.end_row
          }
        }).catch(err => {
          console.error(`[ORCHESTRATOR] Failed to invoke chunk ${chunk.chunk_index}:`, err);
        });
      }
      
      console.log('[ORCHESTRATOR] All chunks launched');
    };

    if (typeof (globalThis as any).EdgeRuntime !== 'undefined' && (globalThis as any).EdgeRuntime?.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(launchChunks());
    } else {
      launchChunks().catch(err => {
        console.error('[ORCHESTRATOR] Background task error:', err);
      });
    }

    console.log('[ORCHESTRATOR] Returning immediate response to client');
    
    return new Response(
      JSON.stringify({
        started: true,
        job_id: jobId,
        total_rows: totalRows,
        chunks: chunkCount,
        message: `Import démarré avec ${chunkCount} chunks de traitement`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[ORCHESTRATOR] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
