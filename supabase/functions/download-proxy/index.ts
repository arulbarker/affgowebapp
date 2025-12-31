import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, filename } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Download proxy request:', { url: url.substring(0, 100), filename });

    // Fetch the file from the external URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    console.log('File fetched successfully:', { size: arrayBuffer.byteLength, contentType });

    // Return the file with appropriate headers
    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename || 'download'}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Download proxy error:', error);
    const message = error instanceof Error ? error.message : 'Failed to download file';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
