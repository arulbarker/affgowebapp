import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Image, Loader2, Sparkles, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const COST = 1500;

const ASPECT_RATIOS = [
  { id: 'square', label: '1:1', description: 'Persegi', value: 'square_hd' },
  { id: 'portrait', label: '9:16', description: 'Portrait', value: 'portrait_16_9' },
  { id: 'landscape', label: '16:9', description: 'Landscape', value: 'landscape_16_9' },
  { id: 'portrait_4_3', label: '3:4', description: 'Poster', value: 'portrait_4_3' },
  { id: 'landscape_4_3', label: '4:3', description: 'Presentasi', value: 'landscape_4_3' },
];

const STYLE_PRESETS = [
  { id: 'poster', label: 'Poster Promosi', prompt: 'Professional promotional poster design with bold typography and vibrant colors' },
  { id: 'social', label: 'Social Media', prompt: 'Modern social media post design, eye-catching and trendy' },
  { id: 'minimalist', label: 'Minimalist', prompt: 'Clean minimalist design with elegant typography and subtle colors' },
  { id: 'vintage', label: 'Vintage', prompt: 'Retro vintage style design with classic fonts and warm colors' },
  { id: 'neon', label: 'Neon/Glow', prompt: 'Neon glow effect design with dark background and vibrant glowing colors' },
];

const Poster = () => {
  const navigate = useNavigate();
  const { user, credits, loading, refreshCredits } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);
  const [selectedStyle, setSelectedStyle] = useState<typeof STYLE_PRESETS[0] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Tulis deskripsi poster yang kamu mau');
      return;
    }

    if (credits < COST) {
      toast.error('Saldo tidak cukup. Top up dulu yuk!');
      navigate('/topup');
      return;
    }

    if (!user) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      // Combine user prompt with style preset
      const fullPrompt = selectedStyle 
        ? `${selectedStyle.prompt}. ${prompt}`
        : prompt;

      const { data, error } = await supabase.functions.invoke('generate-ai', {
        body: { 
          type: 'image',
          prompt: fullPrompt,
          userId: user.id,
          aspectRatio: selectedRatio.value,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setGeneratedImage(data.url);
      await refreshCredits();
      toast.success('Poster berhasil dibuat!');
    } catch (error: any) {
      console.error('Generate error:', error);
      toast.error(error.message || 'Gagal membuat poster');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;
    
    try {
      toast.info('Menyiapkan download...');
      
      // Use download proxy to bypass CORS
      const { data, error } = await supabase.functions.invoke('download-proxy', {
        body: {
          url: generatedImage,
          filename: `poster-${Date.now()}.png`,
        },
      });

      if (error) {
        // Fallback: open in new tab if proxy fails
        window.open(generatedImage, '_blank');
        toast.info('Gambar dibuka di tab baru. Klik kanan dan pilih "Save image as..."');
        return;
      }

      // Create blob from response
      const blob = new Blob([data], { type: 'image/png' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `poster-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Download berhasil!');
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(generatedImage, '_blank');
      toast.info('Gambar dibuka di tab baru. Klik kanan dan pilih "Save image as..."');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24 md:pb-8">
      <div className="mx-auto max-w-md md:max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Buat Poster AI</h1>
            <p className="text-sm text-muted-foreground">Rp 1.500/gambar</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Style Preset */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Pilih Gaya (Opsional)
              </CardTitle>
              <CardDescription>
                Pilih gaya desain untuk hasil yang lebih optimal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((style) => (
                  <Button
                    key={style.id}
                    variant={selectedStyle?.id === style.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStyle(selectedStyle?.id === style.id ? null : style)}
                    disabled={isGenerating}
                    className="gap-1"
                  >
                    {selectedStyle?.id === style.id && <Check className="h-3 w-3" />}
                    {style.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Aspect Ratio */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ukuran & Rasio</CardTitle>
              <CardDescription>
                Pilih ukuran yang sesuai kebutuhanmu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedRatio(ratio)}
                    disabled={isGenerating}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border-2 p-3 transition-all",
                      selectedRatio.id === ratio.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div 
                      className={cn(
                        "mb-2 bg-muted-foreground/20 rounded",
                        ratio.id === 'square' && "h-8 w-8",
                        ratio.id === 'portrait' && "h-10 w-6",
                        ratio.id === 'landscape' && "h-6 w-10",
                        ratio.id === 'portrait_4_3' && "h-10 w-8",
                        ratio.id === 'landscape_4_3' && "h-8 w-10",
                      )}
                    />
                    <span className="text-xs font-medium">{ratio.label}</span>
                    <span className="text-[10px] text-muted-foreground">{ratio.description}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Deskripsi Poster</CardTitle>
              <CardDescription>
                Jelaskan detail poster yang kamu inginkan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Contoh: Poster promosi diskon 50% untuk toko baju, warna merah dan kuning, dengan gambar baju dan tas..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="resize-none"
                  disabled={isGenerating}
                />
                <p className="text-xs text-muted-foreground">
                  Tips: Semakin detail deskripsi, semakin bagus hasilnya
                </p>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Membuat poster... (30-60 detik)
                  </>
                ) : (
                  <>
                    <Image className="mr-2 h-4 w-4" />
                    Buat Poster (Rp 1.500)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          {generatedImage && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hasil Poster</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <img
                  src={generatedImage}
                  alt="Generated poster"
                  className="w-full rounded-lg"
                />
                <Button className="w-full" variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Poster
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Poster;
