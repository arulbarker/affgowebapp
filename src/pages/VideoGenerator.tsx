import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Video, Loader2, Upload, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const VIDEO_RESOLUTIONS = [
  { id: '720p', label: '720p', description: 'Standar' },
  { id: '1080p', label: '1080p', description: 'Pro' },
];

const VIDEO_DURATIONS = [
  { id: 5, label: '5 Detik', value: 5 },
  { id: 10, label: '10 Detik', value: 10 },
];

// Pricing matrix: resolution -> duration -> price
const PRICING_MATRIX: Record<string, Record<number, number>> = {
  '720p': { 5: 7500, 10: 14000 },
  '1080p': { 5: 11000, 10: 20500 },
};

const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', description: 'Portrait (Reels/TikTok)', width: 720, height: 1280 },
  { id: '16:9', label: '16:9', description: 'Landscape (YouTube)', width: 1280, height: 720 },
  { id: '1:1', label: '1:1', description: 'Square (Instagram)', width: 1080, height: 1080 },
  { id: '4:3', label: '4:3', description: 'Classic', width: 1024, height: 768 },
  { id: '3:4', label: '3:4', description: 'Portrait Classic', width: 768, height: 1024 },
];

const VideoGenerator = () => {
  const navigate = useNavigate();
  const { user, credits, loading, refreshCredits } = useAuth();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedResolution, setSelectedResolution] = useState(VIDEO_RESOLUTIONS[0]); // Default 720p
  const [selectedDuration, setSelectedDuration] = useState(VIDEO_DURATIONS[0]); // Default 5s
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Calculate current cost based on resolution and duration
  const currentCost = PRICING_MATRIX[selectedResolution.id]?.[selectedDuration.value] || 7500;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 10MB');
        return;
      }
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setGeneratedVideo(null);
    }
  }, []);

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  // Crop and resize image to selected aspect ratio
  const cropImageToAspectRatio = async (file: File, aspectRatio: typeof ASPECT_RATIOS[0]): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        const targetWidth = aspectRatio.width;
        const targetHeight = aspectRatio.height;
        const targetRatio = targetWidth / targetHeight;
        const imgRatio = img.width / img.height;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = img.width;
        let sourceHeight = img.height;

        // Crop to match target aspect ratio
        if (imgRatio > targetRatio) {
          // Image is wider, crop sides
          sourceWidth = img.height * targetRatio;
          sourceX = (img.width - sourceWidth) / 2;
        } else {
          // Image is taller, crop top/bottom
          sourceHeight = img.width / targetRatio;
          sourceY = (img.height - sourceHeight) / 2;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    // Crop image to selected aspect ratio
    const croppedBlob = await cropImageToAspectRatio(file, selectedAspectRatio);
    const croppedFile = new File([croppedBlob], file.name, { type: 'image/jpeg' });

    const fileExt = 'jpg';
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('generations')
      .upload(fileName, croppedFile);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Gagal upload gambar');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('generations')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const pollVideoStatus = async (
    predictionId: string,
    cost: number,
    prompt: string
  ): Promise<string> => {
    const maxAttempts = 120; // 6 minutes with 3s intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const { data, error } = await supabase.functions.invoke('check-video-status', {
          body: {
            predictionId,
            userId: user?.id,
            prompt,
            cost,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        if (data.status === 'COMPLETED') {
          return data.url;
        } else if (data.status === 'FAILED') {
          throw new Error(data.error || 'Video generation failed');
        }

        // Still in progress, continue polling
        console.log('Video status:', data.status);
      } catch (err) {
        console.error('Poll error:', err);
        // Continue polling on transient errors
      }

      attempts++;
    }

    throw new Error('Video generation timed out');
  };

  const handleGenerate = async () => {
    if (!selectedImage) {
      toast.error('Pilih gambar terlebih dahulu');
      return;
    }

    if (credits < currentCost) {
      toast.error('Saldo tidak cukup. Top up dulu yuk!');
      navigate('/topup');
      return;
    }

    if (!user) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    setIsGenerating(true);
    setGeneratedVideo(null);

    try {
      setIsUploading(true);
      const imageUrl = await uploadImageToStorage(selectedImage);
      setIsUploading(false);

      const fullPrompt = customPrompt.trim()
        ? customPrompt
        : 'Make this image come alive with natural, cinematic motion';

      const { data, error } = await supabase.functions.invoke('generate-ai', {
        body: {
          type: 'video',
          imageUrl: imageUrl,
          prompt: fullPrompt,
          negativePrompt: negativePrompt.trim() || undefined,
          audioUrl: audioUrl.trim() || undefined,
          userId: user.id,
          videoResolution: selectedResolution.id,
          duration: selectedDuration.value,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // If video is processing, poll for status
      if (data.status === 'processing' && data.predictionId) {
        toast.info('Video sedang diproses, mohon tunggu 2-5 menit...');

        const videoUrl = await pollVideoStatus(
          data.predictionId,
          data.cost,
          fullPrompt
        );

        setGeneratedVideo(videoUrl);
        await refreshCredits();
        toast.success('Video berhasil dibuat!');
      } else if (data.url) {
        // Immediate result (for images or instant video)
        setGeneratedVideo(data.url);
        await refreshCredits();
        toast.success('Video berhasil dibuat!');
      }
    } catch (error: any) {
      console.error('Generate error:', error);
      toast.error(error.message || 'Gagal membuat video');
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedVideo) return;

    try {
      toast.info('Menyiapkan download...');

      // Direct fetch to properly get the video file
      const response = await fetch(generatedVideo);
      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${Date.now()}.mp4`;

      // For mobile compatibility
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      toast.success('Download berhasil!');
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(generatedVideo, '_blank');
      toast.info('Video dibuka di tab baru. Klik kanan dan pilih "Save video as..."');
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
            <h1 className="text-xl font-bold">Hidupkan Foto</h1>
            <p className="text-sm text-muted-foreground">Mulai dari Rp 6.000</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Image Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4 text-primary" />
                Upload Foto
              </CardTitle>
              <CardDescription>
                Foto wajah/orang akan menghasilkan hasil terbaik. Maks 10MB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!previewUrl ? (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50">
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Klik atau drag foto ke sini
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                    disabled={isGenerating}
                  />
                </label>
              ) : (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full rounded-lg"
                  />
                  {!isGenerating && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>



          {/* Aspect Ratio */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Rasio Video</CardTitle>
              <CardDescription>
                Gambar akan di-crop otomatis sesuai rasio yang dipilih
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {ASPECT_RATIOS.map((ratio) => (
                  <Button
                    key={ratio.id}
                    variant={selectedAspectRatio.id === ratio.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedAspectRatio(ratio)}
                    disabled={isGenerating}
                    className="flex-col h-auto py-3"
                  >
                    <span className="font-semibold">{ratio.label}</span>
                    <span className="text-xs opacity-70">{ratio.description}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Video Quality */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Kualitas Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resolution Selection */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Resolusi</p>
                <div className="grid grid-cols-3 gap-2">
                  {VIDEO_RESOLUTIONS.map((res) => (
                    <Button
                      key={res.id}
                      variant={selectedResolution.id === res.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedResolution(res)}
                      disabled={isGenerating}
                      className="flex-col h-auto py-2"
                    >
                      <span className="font-bold">{res.label}</span>
                      <span className="text-[10px] opacity-70">{res.description}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Duration Selection */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Durasi</p>
                <div className="grid grid-cols-2 gap-2">
                  {VIDEO_DURATIONS.map((dur) => (
                    <Button
                      key={dur.id}
                      variant={selectedDuration.id === dur.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDuration(dur)}
                      disabled={isGenerating}
                      className="flex-col h-auto py-2"
                    >
                      <span className="font-bold">{dur.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Price Display */}
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Harga</p>
                <p className="text-xl font-bold text-primary">Rp {currentCost.toLocaleString('id-ID')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prompt (Opsional)</CardTitle>
              <CardDescription>
                Tambahkan instruksi khusus untuk gerakan video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Contoh: Rambut tertiup angin pelan, mata berkedip..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
                className="resize-none"
                disabled={isGenerating}
              />
            </CardContent>
          </Card>

          {/* Negative Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Negative Prompt (Opsional)</CardTitle>
              <CardDescription>
                Hal yang ingin dihindari dalam video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Contoh: blur, distorsi, low quality..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
                className="resize-none"
                disabled={isGenerating}
              />
            </CardContent>
          </Card>

          {/* Audio URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Audio/Musik (Opsional)</CardTitle>
              <CardDescription>
                Jika kosong, audio akan di-generate otomatis oleh AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="https://example.com/audio.mp3"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Masukkan URL langsung ke file audio (.mp3/.wav). Bisa dari Google Drive (gunakan link download langsung), Dropbox, atau hosting file lainnya.
              </p>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Card>
            <CardContent className="pt-6">
              <Button
                className="w-full"
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !selectedImage}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploading ? 'Mengupload...' : 'Membuat video... (2-5 menit)'}
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    Buat Video (Rp {currentCost.toLocaleString('id-ID')})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          {generatedVideo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hasil Video</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <video
                  src={generatedVideo}
                  controls
                  className="w-full rounded-lg"
                  autoPlay
                  loop
                />
                <Button className="w-full" variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Video
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoGenerator;
