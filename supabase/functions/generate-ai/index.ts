import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COSTS = {
  image: 1500,  // Rp 1.500 per poster
  video_5: 6000,  // Rp 6.000 per 5s video
  video_8: 8000,  // Rp 8.000 per 8s video
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, prompt, imageUrl, userId, aspectRatio, duration, negativePrompt, audioUrl } = await req.json();
    
    console.log('Generate AI request:', { type, prompt, userId, aspectRatio, duration });

    if (!type || !userId) {
      throw new Error('Type and userId are required');
    }

    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's token to verify they're authenticated
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('User not authenticated');
    }

    // Verify the userId matches the authenticated user
    if (user.id !== userId) {
      throw new Error('User ID mismatch');
    }

    const falKey = Deno.env.get('FAL_KEY');
    if (!falKey) {
      throw new Error('FAL_KEY is not configured');
    }

    const atlasCloudKey = Deno.env.get('ATLASCLOUD_API_KEY');
    if (!atlasCloudKey) {
      throw new Error('ATLASCLOUD_API_KEY is not configured');
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Calculate cost based on type and duration
    let cost: number;
    if (type === 'image') {
      cost = COSTS.image;
    } else if (type === 'video') {
      cost = duration === 8 ? COSTS.video_8 : COSTS.video_5;
    } else {
      throw new Error('Invalid generation type');
    }

    if (profile.credits < cost) {
      throw new Error('Saldo tidak cukup. Silakan top up terlebih dahulu.');
    }

    let resultUrl: string;

    if (type === 'image') {
      // Generate image using Fal.ai Gemini 3 Pro Image
      if (!prompt) {
        throw new Error('Prompt is required for image generation');
      }

      console.log('Calling Fal.ai Gemini 3 Pro Image for poster generation...');
      
      // Map aspect ratio from frontend to Gemini format
      const aspectRatioMap: Record<string, string> = {
        'square': '1:1',
        'square_hd': '1:1',
        'portrait_4_3': '3:4',
        'portrait_16_9': '9:16',
        'landscape_4_3': '4:3',
        'landscape_16_9': '16:9',
      };
      
      const geminiAspectRatio = aspectRatioMap[aspectRatio] || '1:1';
      
      const falResponse = await fetch('https://queue.fal.run/fal-ai/gemini-3-pro-image-preview', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          aspect_ratio: geminiAspectRatio,
          num_images: 1,
          output_format: 'png',
          resolution: '2K',
        }),
      });

      if (!falResponse.ok) {
        const errorText = await falResponse.text();
        console.error('Fal.ai error:', errorText);
        throw new Error('Gagal generate gambar');
      }

      const falData = await falResponse.json();
      console.log('Fal.ai Gemini image response:', falData);

      // Handle async queue response
      if (falData.request_id) {
        // Poll for result
        let attempts = 0;
        const maxAttempts = 90;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const statusResponse = await fetch(`https://queue.fal.run/fal-ai/gemini-3-pro-image-preview/requests/${falData.request_id}/status`, {
            headers: {
              'Authorization': `Key ${falKey}`,
            },
          });
          
          const statusData = await statusResponse.json();
          console.log('Status check:', statusData);
          
          if (statusData.status === 'COMPLETED') {
            const resultResponse = await fetch(`https://queue.fal.run/fal-ai/gemini-3-pro-image-preview/requests/${falData.request_id}`, {
              headers: {
                'Authorization': `Key ${falKey}`,
              },
            });
            const resultData = await resultResponse.json();
            resultUrl = resultData.images?.[0]?.url;
            break;
          } else if (statusData.status === 'FAILED') {
            throw new Error('Image generation failed');
          }
          
          attempts++;
        }
        
        if (!resultUrl!) {
          throw new Error('Generation timed out');
        }
      } else {
        resultUrl = falData.images?.[0]?.url;
      }

    } else if (type === 'video') {
      // Generate video using Atlas Cloud WAN 2.6 model
      if (!imageUrl) {
        throw new Error('Image URL is required for video generation');
      }

      console.log('Calling Atlas Cloud WAN 2.6 for video generation...');

      const atlasResponse = await fetch('https://api.atlascloud.ai/api/v1/model/generateVideo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${atlasCloudKey}`,
        },
        body: JSON.stringify({
          model: 'alibaba/wan-2.6/image-to-video',
          image: imageUrl,
          prompt: prompt || "Make this image come alive with natural, cinematic motion and ambient sounds",
          negative_prompt: negativePrompt || "blur, distortion, low quality, ugly, deformed",
          duration: duration === 8 ? 8 : 5,
          resolution: "720p",
          enable_prompt_expansion: false,
          seed: -1,
          shot_type: "single",
          generate_audio: true,
          ...(audioUrl && { audio_url: audioUrl }),
        }),
      });

      if (!atlasResponse.ok) {
        const errorText = await atlasResponse.text();
        console.error('Atlas Cloud error:', errorText);
        throw new Error('Gagal generate video');
      }

      const atlasData = await atlasResponse.json();
      console.log('Atlas Cloud video response:', atlasData);

      // Return immediately with prediction_id for client-side polling
      const predictionId = atlasData.data?.id;
      if (predictionId) {
        return new Response(
          JSON.stringify({ 
            success: true,
            status: 'processing',
            predictionId: predictionId,
            cost: cost,
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      } else if (atlasData.data?.outputs?.[0]) {
        // Immediate result (rare but possible)
        resultUrl = atlasData.data.outputs[0];
      } else {
        console.error('Unexpected Atlas Cloud response:', atlasData);
        throw new Error('Unexpected response from Atlas Cloud');
      }
    } else {
      throw new Error('Invalid type');
    }

    if (!resultUrl!) {
      throw new Error('No result URL returned');
    }

    // Deduct credits (only for immediate results like images)
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
        type: type,
        image_url: type === 'image' ? resultUrl : null,
        video_url: type === 'video' ? resultUrl : null,
        prompt: prompt,
        cost: cost,
      });

    console.log('Generation successful:', { type, resultUrl, newCredits });

    return new Response(
      JSON.stringify({ 
        success: true,
        url: resultUrl,
        newCredits: newCredits,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-ai:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
