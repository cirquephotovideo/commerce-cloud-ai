import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AmazonAutoLinkJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_to_process: number | null;
  processed_count: number;
  links_created: number;
  current_offset: number;
  batch_size: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export function useAmazonAutoLinkJob() {
  const [currentJob, setCurrentJob] = useState<AmazonAutoLinkJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load the most recent job
  const loadCurrentJob = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('amazon_auto_link_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCurrentJob(data as AmazonAutoLinkJob);
      }
    } catch (error) {
      console.error('Error loading Amazon job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('amazon-jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'amazon_auto_link_jobs'
        },
        (payload) => {
          console.log('Amazon job update:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const jobData = payload.new as any;
            const job: AmazonAutoLinkJob = {
              ...jobData,
              status: jobData.status as AmazonAutoLinkJob['status']
            };
            setCurrentJob(job);

            // Show toast on completion
            if (job.status === 'completed') {
              toast({
                title: "✅ Fusion Amazon Terminée",
                description: `${job.links_created} nouveau${job.links_created > 1 ? 'x' : ''} lien${job.links_created > 1 ? 's' : ''} créé${job.links_created > 1 ? 's' : ''}`,
              });
            } else if (job.status === 'failed') {
              toast({
                title: "❌ Erreur de Fusion",
                description: job.error_message || "Une erreur est survenue",
                variant: "destructive",
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const isJobRunning = currentJob?.status === 'pending' || currentJob?.status === 'processing';
  const progress = currentJob?.total_to_process 
    ? Math.round((currentJob.processed_count / currentJob.total_to_process) * 100)
    : 0;

  return {
    currentJob,
    isLoading,
    isJobRunning,
    progress,
    reloadJob: loadCurrentJob
  };
}
