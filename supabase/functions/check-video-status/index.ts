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
    const { predictionId, userId, prompt, cost } = await req.json();
    
    console.log('Check video status:', { predictionId, userId });

    if (!predictionId || !userId) {
      throw new Error('Missing required parameters');
    }

    const atlasCloudKey = Deno.env.get('ATLASCLOUD_API_KEY');
    if (!atlasCloudKey) {
      throw new Error('ATLASCLOUD_API_KEY is not configured');
    }

    // Check status using Atlas Cloud poll endpoint
    const pollUrl = `https://api.atlascloud.ai/api/v1/model/prediction/${predictionId}`;
    
    const statusResponse = await fetch(pollUrl, {
      headers: {
        'Authorization': `Bearer ${atlasCloudKey}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Status check error:', statusResponse.status, errorText);
      throw new Error('Failed to check status');
    }

    const result = await statusResponse.json();
    console.log('Video status:', result);

    const status = result.data?.status;
    
    if (status === 'completed' || status === 'succeeded') {
      const videoUrl = result.data?.outputs?.[0];

      if (!videoUrl) {
        console.error('No video URL in result:', result);
        throw new Error('No video URL in result');
      }

      // Deduct credits and save to database
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get current credits
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        throw new Error('User profile not found');
      }

      // Deduct credits
      const newCredits = profile.credits - cost;
      await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', userId);

      // Save generation record
      await supabase
        .from('generations')
        .insert({
          user_id: userId,
          type: 'video',
          video_url: videoUrl,
          prompt: prompt,
          cost: cost,
        });

      console.log('Video generation completed and saved:', { videoUrl, newCredits });

      return new Response(
        JSON.stringify({ 
          status: 'COMPLETED',
          url: videoUrl,
          newCredits: newCredits,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } else if (status === 'failed') {
      const errorMsg = result.data?.error || 'Video generation failed';
      console.error('Video generation failed:', errorMsg);
      
      return new Response(
        JSON.stringify({ 
          status: 'FAILED',
          error: errorMsg,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } else {
      // Still in progress (pending, processing, etc.)
      return new Response(
        JSON.stringify({ 
          status: 'IN_PROGRESS',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in check-video-status:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
