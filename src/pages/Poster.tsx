import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Image, Loader2, Sparkles, Download, Check, ChevronDown, ChevronUp, Palette, X, ZoomIn, Compass } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useGeneration } from '@/context/GenerationContext';

// Resolution options with pricing
const RESOLUTIONS = [
  { id: '2k', label: '2K', description: '2048px (Ultra HD)', size: '2048*2048', cost: 3000 },
  { id: '4k', label: '4K', description: '4096px (Print Ready)', size: '4096*4096', cost: 4500 },
];

// Poster Types - Organized by Category
const POSTER_CATEGORIES = [
  {
    category: '🎉 Events & Entertainment',
    types: [
      { id: 'event', label: 'Event/Acara', prompt: 'event promotional poster' },
      { id: 'concert', label: 'Konser/Musik', prompt: 'music concert poster' },
      { id: 'festival', label: 'Festival', prompt: 'festival event poster' },
      { id: 'exhibition', label: 'Pameran/Exhibition', prompt: 'art exhibition poster' },
      { id: 'comedy', label: 'Stand Up Comedy', prompt: 'stand up comedy show poster' },
      { id: 'workshop', label: 'Workshop/Seminar', prompt: 'workshop seminar poster' },
    ]
  },
  {
    category: '🛍️ Business & Promo',
    types: [
      { id: 'promo', label: 'Promo/Diskon', prompt: 'promotional discount sale poster' },
      { id: 'grandopening', label: 'Grand Opening', prompt: 'grand opening celebration poster' },
      { id: 'flashsale', label: 'Flash Sale', prompt: 'flash sale limited time offer poster' },
      { id: 'hiring', label: 'Lowongan Kerja', prompt: 'job hiring recruitment poster' },
      { id: 'comingsoon', label: 'Coming Soon', prompt: 'coming soon teaser poster' },
    ]
  },
  {
    category: '🍔 Food & Beverage',
    types: [
      { id: 'restaurant', label: 'Restoran/Kuliner', prompt: 'restaurant food menu poster' },
      { id: 'cafe', label: 'Cafe/Coffee Shop', prompt: 'cafe coffee shop poster' },
      { id: 'catering', label: 'Catering', prompt: 'catering service poster' },
      { id: 'fooddelivery', label: 'Food Delivery', prompt: 'food delivery service poster' },
    ]
  },
  {
    category: '💄 Lifestyle & Beauty',
    types: [
      { id: 'salon', label: 'Salon/Barbershop', prompt: 'hair salon barbershop poster' },
      { id: 'spa', label: 'Spa & Wellness', prompt: 'spa wellness relaxation poster' },
      { id: 'fashion', label: 'Fashion', prompt: 'fashion clothing brand poster' },
      { id: 'gym', label: 'Fitness/Gym', prompt: 'fitness gym workout poster' },
    ]
  },
  {
    category: '📱 Digital & Social',
    types: [
      { id: 'socialmedia', label: 'Social Media Post', prompt: 'social media post design' },
      { id: 'igstory', label: 'Instagram Story', prompt: 'instagram story design' },
      { id: 'youtube', label: 'YouTube Thumbnail', prompt: 'youtube video thumbnail' },
      { id: 'podcast', label: 'Podcast Cover', prompt: 'podcast cover art design' },
    ]
  },
  {
    category: '🎓 Education & Info',
    types: [
      { id: 'education', label: 'Edukasi/Kursus', prompt: 'educational course poster' },
      { id: 'webinar', label: 'Webinar', prompt: 'online webinar poster' },
      { id: 'announcement', label: 'Pengumuman', prompt: 'announcement notice poster' },
      { id: 'infographic', label: 'Infografis', prompt: 'infographic informational poster' },
    ]
  },
  {
    category: '🏢 Corporate',
    types: [
      { id: 'corporate', label: 'Corporate Event', prompt: 'corporate professional event poster' },
      { id: 'productlaunch', label: 'Product Launch', prompt: 'product launch announcement poster' },
      { id: 'companyprofile', label: 'Company Profile', prompt: 'company profile business poster' },
    ]
  },
  {
    category: '🎨 Special Occasions',
    types: [
      { id: 'birthday', label: 'Ulang Tahun', prompt: 'birthday celebration party poster' },
      { id: 'wedding', label: 'Pernikahan', prompt: 'wedding invitation elegant poster' },
      { id: 'ramadan', label: 'Ramadan/Lebaran', prompt: 'ramadan eid mubarak islamic poster' },
      { id: 'christmas', label: 'Christmas/Natal', prompt: 'christmas holiday celebration poster' },
      { id: 'newyear', label: 'Tahun Baru', prompt: 'new year celebration poster' },
      { id: 'custom', label: 'Custom/Bebas', prompt: 'creative poster design' },
    ]
  },
];

const ALL_POSTER_TYPES = POSTER_CATEGORIES.flatMap(cat => cat.types);

const COLOR_THEMES = [
  { id: 'vibrant', label: 'Vibrant', prompt: 'vibrant bright colorful', color: 'bg-gradient-to-r from-pink-500 to-yellow-500' },
  { id: 'professional', label: 'Professional', prompt: 'professional blue navy corporate', color: 'bg-gradient-to-r from-blue-600 to-blue-800' },
  { id: 'elegant', label: 'Elegant', prompt: 'elegant black gold luxury', color: 'bg-gradient-to-r from-yellow-600 to-gray-900' },
  { id: 'nature', label: 'Nature', prompt: 'natural green earth tones', color: 'bg-gradient-to-r from-green-500 to-emerald-700' },
  { id: 'sunset', label: 'Sunset', prompt: 'warm sunset orange red gradient', color: 'bg-gradient-to-r from-orange-500 to-red-600' },
  { id: 'ocean', label: 'Ocean', prompt: 'ocean blue teal aqua fresh', color: 'bg-gradient-to-r from-cyan-400 to-blue-600' },
  { id: 'pastel', label: 'Pastel', prompt: 'soft pastel colors gentle', color: 'bg-gradient-to-r from-pink-200 to-purple-200' },
  { id: 'neon', label: 'Neon', prompt: 'neon glow dark background cyberpunk', color: 'bg-gradient-to-r from-purple-600 to-pink-500' },
  { id: 'monochrome', label: 'Monochrome', prompt: 'black and white monochrome minimal', color: 'bg-gradient-to-r from-gray-700 to-gray-900' },
  { id: 'custom', label: 'Custom', prompt: '', color: '' },
];

const DESIGN_STYLES = [
  { id: 'modern', label: 'Modern', prompt: 'modern contemporary clean layout' },
  { id: 'minimalist', label: 'Minimalist', prompt: 'minimalist simple elegant whitespace' },
  { id: 'bold', label: 'Bold & Colorful', prompt: 'bold colorful eye-catching dynamic' },
  { id: 'vintage', label: 'Vintage/Retro', prompt: 'vintage retro classic nostalgic' },
  { id: 'professional', label: 'Professional', prompt: 'professional corporate business formal' },
  { id: 'creative', label: 'Creative', prompt: 'creative artistic unique innovative' },
  { id: 'elegant', label: 'Elegant/Luxury', prompt: 'elegant luxury premium sophisticated' },
  { id: 'playful', label: 'Playful/Fun', prompt: 'playful fun cheerful energetic' },
  { id: 'geometric', label: 'Geometric', prompt: 'geometric shapes abstract patterns' },
  { id: 'gradient', label: 'Gradient', prompt: 'smooth gradient flowing colors' },
  { id: 'custom', label: 'Custom', prompt: '' },
];

const ASPECT_RATIOS = [
  { id: 'portrait_4_3', label: '3:4', description: 'Poster', value: 'portrait_4_3' },
  { id: 'square', label: '1:1', description: 'Square', value: 'square_hd' },
  { id: 'portrait', label: '9:16', description: 'Story', value: 'portrait_16_9' },
  { id: 'landscape', label: '16:9', description: 'Wide', value: 'landscape_16_9' },
  { id: 'landscape_4_3', label: '4:3', description: 'Landscape', value: 'landscape_4_3' },
];

const Poster = () => {
  const navigate = useNavigate();
  const { user, credits, loading, refreshCredits } = useAuth();

  // Form state
  const [posterType, setPosterType] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');
  const [colorTheme, setColorTheme] = useState(COLOR_THEMES[0]);
  const [customColor1, setCustomColor1] = useState('#FF6B6B');
  const [customColor2, setCustomColor2] = useState('#4ECDC4');
  const [designStyle, setDesignStyle] = useState(DESIGN_STYLES[0]);
  const [customStyleText, setCustomStyleText] = useState('');
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);

  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [language, setLanguage] = useState({ id: 'id', label: '🇮🇩 Indonesia', prompt: 'in Indonesian language' });

  // Manual Prompt Mode
  const [isManualPrompt, setIsManualPrompt] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);


  const getColorPrompt = () => {
    if (colorTheme.id === 'custom') {
      return `custom color palette with primary color ${customColor1} and secondary color ${customColor2}`;
    }
    return colorTheme.prompt;
  };

  const getStylePrompt = () => {
    if (designStyle.id === 'custom') {
      return customStyleText || 'creative artistic design';
    }
    return designStyle.prompt;
  };

  const composePrompt = () => {
    const selectedType = ALL_POSTER_TYPES.find(t => t.id === posterType);

    let prompt = `Create a professional ${selectedType?.prompt || 'promotional poster'}`;

    if (title) {
      prompt += ` with bold title text "${title}"`;
    }

    if (subtitle) {
      prompt += ` and tagline "${subtitle}"`;
    }

    if (dateTime) {
      prompt += `. Include date/time: ${dateTime}`;
    }

    if (location) {
      prompt += `. Location: ${location}`;
    }

    if (contact) {
      prompt += `. Contact info: ${contact}`;
    }

    prompt += `. Color theme: ${getColorPrompt()}`;
    prompt += `. Design style: ${getStylePrompt()}`;
    prompt += `. High quality, professional typography, ready for print`;

    return prompt;
  };

  // Context
  const { startGeneration, isGenerating: isGlobalGenerating, getTaskByType } = useGeneration();
  const activeTask = getTaskByType('poster');
  const isGenerating = isGlobalGenerating && activeTask?.status === 'pending';
  const generatedImage = activeTask?.status === 'success' ? activeTask.resultUrl : null;
  const generatedData = activeTask?.data;



  const LANGUAGES = [
    { id: 'id', label: '🇮🇩 Indonesia', prompt: 'in Indonesian language' },
    { id: 'en', label: '🇬🇧 English', prompt: 'in English' },
    { id: 'jv', label: 'Jawa (Krama/Ngoko)', prompt: 'in Javanese language' },
    { id: 'su', label: 'Sunda', prompt: 'in Sundanese language' },
  ];

  const handleGenerate = async () => {
    if (credits < resolution.cost) {
      toast.error('Saldo tidak cukup. Top up dulu yuk!');
      navigate('/topup');
      return;
    }

    if (!user) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    let finalPrompt = '';

    if (isManualPrompt) {
      if (!manualPrompt.trim()) {
        toast.error('Tulis prompt poster terlebih dahulu');
        return;
      }
      finalPrompt = manualPrompt;
    } else {
      if (!posterType) {
        toast.error('Pilih jenis poster terlebih dahulu');
        return;
      }
      if (!title.trim()) {
        toast.error('Tulis judul poster');
        return;
      }
      finalPrompt = composePrompt();
    }

    // Add language instruction
    finalPrompt += `. Text must be ${language.prompt}.`;

    await startGeneration('poster', {
      type: 'image',
      prompt: finalPrompt,
      userId: user.id,
      aspectRatio: aspectRatio.value,
      resolution: resolution.id,
    });
    // Context handles the rest (api call, success/error state)
  };
  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      toast.info('Menyiapkan download...');

      // Fetch the image directly
      const response = await fetch(generatedImage);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const blob = await response.blob();
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

  const handlePublish = async () => {
    if (!generatedData || !generatedData.id) {
      toast.error('Data poster tidak ditemukan');
      return;
    }

    try {
      toast.info('Mempublikasikan ke Explore...');

      const { error } = await supabase
        .from('generations')
        .update({ is_public: true })
        .eq('id', generatedData.id);

      if (error) throw error;

      toast.success('Berhasil dipublish ke Explore!');
    } catch (error: any) {
      console.error('Publish error:', error);
      toast.error('Gagal mempublish: ' + error.message);
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
            <h1 className="text-xl font-bold">🎨 Poster Generator Pro</h1>
            <p className="text-sm text-muted-foreground">Buat poster profesional dalam hitungan detik</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step 1: Resolution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
                Kualitas Gambar
              </CardTitle>
              <CardDescription>
                Pilih resolusi gambar yang diinginkan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {RESOLUTIONS.map((res) => (
                  <button
                    key={res.id}
                    onClick={() => setResolution(res)}
                    disabled={isGenerating}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border-2 p-4 transition-all",
                      resolution.id === res.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="text-lg font-bold">{res.label}</span>
                    <span className="text-xs text-muted-foreground">{res.description}</span>
                    <span className="mt-1 text-sm font-semibold text-primary">Rp {res.cost.toLocaleString('id-ID')}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Manual Prompt Toggle */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1">
                <Label htmlFor="manual-mode" className="font-bold">Mode Prompt Manual</Label>
                <p className="text-xs text-muted-foreground">Aktifkan untuk menulis prompt sendiri secara bebas</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsManualPrompt(!isManualPrompt)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    isManualPrompt ? "bg-primary" : "bg-input"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
                      isManualPrompt ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {isManualPrompt ? (
            /* Manual Prompt Input */
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
                  Tulis Prompt
                </CardTitle>
                <CardDescription>
                  Jelaskan detail poster yang ingin dibuat dalam bahasa Inggris untuk hasil terbaik
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Describe your poster in detail. Example: A futuristic cyberpunk city poster with neon lights, 80s retro style, highly detailed, 8k resolution..."
                  value={manualPrompt}
                  onChange={(e) => setManualPrompt(e.target.value)}
                  rows={6}
                  disabled={isGenerating}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          ) : (
            /* Automatic Steps */
            <div className="space-y-4">
              {/* Step 2: Poster Type */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
                    Jenis Poster
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={posterType} onValueChange={setPosterType} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis poster..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {POSTER_CATEGORIES.map((category) => (
                        <div key={category.category}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                            {category.category}
                          </div>
                          {category.types.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Step 3: Title & Subtitle */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
                    Informasi Utama
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul Poster *</Label>
                    <Input
                      id="title"
                      placeholder="Contoh: GRAND OPENING, FLASH SALE 50%, WEBINAR GRATIS"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtitle">Subjudul / Tagline</Label>
                    <Input
                      id="subtitle"
                      placeholder="Contoh: Diskon hingga 70%, Join us for amazing experience"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 4: Details */}
              <Card>
                <CardHeader className="pb-3">
                  <button
                    className="flex w-full items-center justify-between"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">4</span>
                      Detail Tambahan (Opsional)
                    </CardTitle>
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </CardHeader>
                {showAdvanced && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="datetime">Tanggal & Waktu</Label>
                      <Input
                        id="datetime"
                        placeholder="Contoh: 25 Januari 2026, 19:00 WIB"
                        value={dateTime}
                        onChange={(e) => setDateTime(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Lokasi / Tempat</Label>
                      <Input
                        id="location"
                        placeholder="Contoh: Grand Ballroom Hotel XYZ, Jakarta"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact">Kontak / Info</Label>
                      <Input
                        id="contact"
                        placeholder="Contoh: 0812-3456-7890, @instagram, www.website.com"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Step 5: Color Theme */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">5</span>
                    Tema Warna
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {COLOR_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setColorTheme(theme)}
                        disabled={isGenerating}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all",
                          colorTheme.id === theme.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {theme.id === 'custom' ? (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500 flex items-center justify-center">
                            <Palette className="h-4 w-4 text-white" />
                          </div>
                        ) : (
                          <div className={cn("h-8 w-8 rounded-full", theme.color)} />
                        )}
                        <span className="text-[10px] font-medium">{theme.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Color Picker */}
                  {colorTheme.id === 'custom' && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium">Pilih Warna Custom:</p>
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs">Warna Primer</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customColor1}
                              onChange={(e) => setCustomColor1(e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer border-0"
                            />
                            <Input
                              value={customColor1}
                              onChange={(e) => setCustomColor1(e.target.value)}
                              className="flex-1 font-mono text-sm"
                              placeholder="#FF6B6B"
                            />
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs">Warna Sekunder</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customColor2}
                              onChange={(e) => setCustomColor2(e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer border-0"
                            />
                            <Input
                              value={customColor2}
                              onChange={(e) => setCustomColor2(e.target.value)}
                              className="flex-1 font-mono text-sm"
                              placeholder="#4ECDC4"
                            />
                          </div>
                        </div>
                      </div>
                      <div
                        className="h-8 rounded-lg"
                        style={{ background: `linear-gradient(to right, ${customColor1}, ${customColor2})` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 6: Design Style */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">6</span>
                    Gaya Desain
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {DESIGN_STYLES.map((style) => (
                      <Button
                        key={style.id}
                        variant={designStyle.id === style.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDesignStyle(style)}
                        disabled={isGenerating}
                        className="gap-1"
                      >
                        {designStyle.id === style.id && <Check className="h-3 w-3" />}
                        {style.label}
                      </Button>
                    ))}
                  </div>

                  {/* Custom Style Input */}
                  {designStyle.id === 'custom' && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <Label className="text-sm">Deskripsikan gaya desain yang diinginkan:</Label>
                      <Textarea
                        placeholder="Contoh: Gaya Y2K dengan efek chrome, futuristic dengan elemen hologram, aesthetic Korea dengan soft tones..."
                        value={customStyleText}
                        onChange={(e) => setCustomStyleText(e.target.value)}
                        rows={3}
                        disabled={isGenerating}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 7: Aspect Ratio */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{isManualPrompt ? 3 : 7}</span>
                Ukuran Poster
              </CardTitle>
              {/* <CardDescription>...</CardDescription> */}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => setAspectRatio(ratio)}
                    disabled={isGenerating}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border-2 p-3 transition-all",
                      aspectRatio.id === ratio.id
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

          {/* Generate Button */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <Button
                className="w-full"
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || (isManualPrompt ? !manualPrompt.trim() : (!posterType || !title.trim()))}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Membuat poster... (30-60 detik)
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Poster (Rp {resolution.cost.toLocaleString('id-ID')})
                  </>
                )}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Saldo: Rp {credits.toLocaleString('id-ID')}
              </p>
            </CardContent>
          </Card>

          {/* Result */}
          {generatedImage && (
            <Card className="border-green-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-green-600">
                  <Check className="h-5 w-5" />
                  Poster Berhasil Dibuat!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="relative cursor-pointer group"
                  onClick={() => setShowPreview(true)}
                >
                  <img
                    src={generatedImage}
                    alt="Generated poster"
                    className="w-full rounded-lg shadow-lg transition-opacity group-hover:opacity-90"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/60 rounded-full p-3">
                      <ZoomIn className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowPreview(true)}>
                    <ZoomIn className="mr-2 h-4 w-4" />
                    Preview Full
                  </Button>
                  <Button className="flex-1" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download HD
                  </Button>
                </div>
                <Button variant="secondary" className="w-full" onClick={handlePublish}>
                  <Compass className="h-4 w-4 mr-2" />
                  Publish to Explore
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {showPreview && generatedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setShowPreview(false)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={generatedImage}
            alt="Preview poster"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
            <Button onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
              <Download className="mr-2 h-4 w-4" />
              Download HD
            </Button>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Tutup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Poster;
