import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COSTS = {
  image_1k: 1600,   // Rp 1.600 per 1K (1024x1024) image
  image_2k: 3000,   // Rp 3.000 per 2K (2048x2048) image
  image_4k: 4500,   // Rp 4.500 per 4K (4096x4096) image
};

// Video pricing matrix: resolution -> duration -> price
const VIDEO_PRICING: Record<string, Record<number, number>> = {
  '480p': { 5: 4500, 10: 6500 },
  '720p': { 5: 7500, 10: 11500 },
  '1080p': { 5: 11000, 10: 16500 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, prompt, imageUrl, userId, aspectRatio, duration, negativePrompt, audioUrl, resolution, videoResolution } = await req.json();

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

    // Calculate cost based on type, duration, and resolution
    let cost: number;
    if (type === 'image') {
      // Resolution-based pricing for images
      if (resolution === '4k') {
        cost = COSTS.image_4k;
      } else if (resolution === '2k') {
        cost = COSTS.image_2k;
      } else {
        cost = COSTS.image_1k; // Default to 1K
      }
    } else if (type === 'video') {
      // Resolution + Duration based pricing for videos
      const resKey = videoResolution || '720p';
      const durKey = duration || 5;
      cost = VIDEO_PRICING[resKey]?.[durKey] || VIDEO_PRICING['720p'][5];
    } else {
      throw new Error('Invalid generation type');
    }

    if (profile.credits < cost) {
      throw new Error('Saldo tidak cukup. Silakan top up terlebih dahulu.');
    }

    let resultUrl: string;

    if (type === 'image') {
      // Generate image using Atlas Cloud ByteDance Seedream v4.5
      if (!prompt) {
        throw new Error('Prompt is required for image generation');
      }

      console.log('Calling Atlas Cloud Seedream v4.5 for image generation...');

      // Map resolution to size
      let imageSize = '1024*1024'; // Default 1K
      if (resolution === '2k') {
        imageSize = '2048*2048';
      } else if (resolution === '4k') {
        imageSize = '4096*4096';
      }

      // Map aspect ratio to appropriate size
      const aspectRatioSizes: Record<string, Record<string, string>> = {
        '1k': {
          'square': '1024*1024',
          'square_hd': '1024*1024',
          'portrait_4_3': '896*1152',
          'portrait_16_9': '768*1344',
          'landscape_4_3': '1152*896',
          'landscape_16_9': '1344*768',
        },
        '2k': {
          'square': '2048*2048',
          'square_hd': '2048*2048',
          'portrait_4_3': '1792*2304',
          'portrait_16_9': '1536*2688',
          'landscape_4_3': '2304*1792',
          'landscape_16_9': '2688*1536',
        },
        '4k': {
          'square': '4096*4096',
          'square_hd': '4096*4096',
          'portrait_4_3': '3584*4608',
          'portrait_16_9': '3072*5376',
          'landscape_4_3': '4608*3584',
          'landscape_16_9': '5376*3072',
        },
      };

      const resKey = resolution || '1k';
      const arKey = aspectRatio || 'square';
      imageSize = aspectRatioSizes[resKey]?.[arKey] || aspectRatioSizes[resKey]?.['square'] || '1024*1024';

      console.log('Using size:', imageSize, 'for resolution:', resKey, 'aspect ratio:', arKey);

      const atlasResponse = await fetch('https://api.atlascloud.ai/api/v1/model/generateImage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${atlasCloudKey}`,
        },
        body: JSON.stringify({
          model: 'bytedance/seedream-v4.5',
          prompt: prompt,
          size: imageSize,
          enable_base64_output: false,
        }),
      });

      if (!atlasResponse.ok) {
        const errorText = await atlasResponse.text();
        console.error('Atlas Cloud Seedream error:', errorText);
        throw new Error('Gagal generate gambar');
      }

      const atlasData = await atlasResponse.json();
      console.log('Atlas Cloud Seedream response:', atlasData);

      // Handle async polling
      const predictionId = atlasData.data?.id;
      if (predictionId) {
        // Poll for result
        let attempts = 0;
        const maxAttempts = 120; // 4 minutes with 2s intervals

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));

          const pollResponse = await fetch(`https://api.atlascloud.ai/api/v1/model/prediction/${predictionId}`, {
            headers: {
              'Authorization': `Bearer ${atlasCloudKey}`,
            },
          });

          if (!pollResponse.ok) {
            console.error('Poll error:', await pollResponse.text());
            attempts++;
            continue;
          }

          const pollData = await pollResponse.json();
          console.log('Poll status:', pollData.data?.status);

          if (pollData.data?.status === 'completed' || pollData.data?.status === 'succeeded') {
            resultUrl = pollData.data?.outputs?.[0];
            break;
          } else if (pollData.data?.status === 'failed') {
            throw new Error(pollData.data?.error || 'Image generation failed');
          }

          attempts++;
        }

        if (!resultUrl) {
          throw new Error('Generation timed out');
        }
      } else if (atlasData.data?.outputs?.[0]) {
        // Immediate result
        resultUrl = atlasData.data.outputs[0];
      } else {
        console.error('Unexpected Atlas Cloud response:', atlasData);
        throw new Error('Unexpected response from Atlas Cloud');
      }

    } else if (type === 'video') {
      // Generate video using Atlas Cloud WAN 2.6 model
      if (!imageUrl) {
        throw new Error('Image URL is required for video generation');
      }

      // Map video resolution and duration
      const targetResolution = videoResolution || '720p';
      const targetDuration = duration || 5;
      console.log('Calling Atlas Cloud WAN 2.6 for video generation at', targetResolution, 'for', targetDuration, 'seconds');

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
          duration: targetDuration,
          resolution: targetResolution,
          enable_prompt_expansion: false,
          seed: -1,
          shot_type: "single",
          generate_audio: true,
          ...(audioUrl && { audio: audioUrl }),
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
