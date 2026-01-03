
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileOutput, Loader2, Sparkles, Download, Check, ChevronDown, ChevronUp, Palette, X, ZoomIn, Compass } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Resolution options with pricing
const RESOLUTIONS = [
    { id: '2k', label: 'Standard', description: '2048px (HD)', size: '2048*2048', cost: 3000 },
    { id: '4k', label: 'Premium', description: '4096px (Print)', size: '4096*4096', cost: 4500 },
];

const INFOGRAPHIC_TYPES = [
    { id: 'informational', label: 'Informational', prompt: 'clean informational infographic with clear headings and icons' },
    { id: 'timeline', label: 'Timeline/History', prompt: 'step-by-step timeline infographic showing progression' },
    { id: 'process', label: 'Process/How-To', prompt: 'process infographic illustrating a workflow or method' },
    { id: 'comparison', label: 'Comparison (Vs)', prompt: 'comparison infographic side-by-side contrast' },
    { id: 'list', label: 'Listicle/Tips', prompt: 'list infographic with numbered points' },
    { id: 'statistical', label: 'Data/Statistical', prompt: 'data visualization infographic with charts and graphs' },
    { id: 'resume', label: 'Resume/CV', prompt: 'professional modern infographic resume cv' },
];

const COLOR_THEMES = [
    { id: 'professional', label: 'Corporate', prompt: 'professional corporate blue navy business palette', color: 'bg-gradient-to-r from-blue-700 to-slate-800' },
    { id: 'vibrant', label: 'Vibrant', prompt: 'bright vibrant colorful energetic palette', color: 'bg-gradient-to-r from-pink-500 to-orange-400' },
    { id: 'minimal', label: 'Minimal', prompt: 'clean minimalist white gray black palette', color: 'bg-gradient-to-r from-gray-200 to-gray-400' },
    { id: 'pastel', label: 'Pastel', prompt: 'soft pastel gentle soothing palette', color: 'bg-gradient-to-r from-green-200 to-blue-200' },
    { id: 'earth', label: 'Earth', prompt: 'organic nature earth tones brown green palette', color: 'bg-gradient-to-r from-green-700 to-yellow-700' },
    { id: 'dark', label: 'Dark Mode', prompt: 'dark modern tech cyber palette', color: 'bg-gradient-to-r from-gray-900 to-purple-900' },
    { id: 'custom', label: 'Custom', prompt: '', color: '' },
];

const LAYOUT_STYLES = [
    { id: 'modern', label: 'Modern Clean', prompt: 'modern clean layout with whitespace' },
    { id: 'illustrative', label: 'Illustrative', prompt: 'hand-drawn vector illustration style' },
    { id: 'flat', label: 'Flat Design', prompt: 'flat design icons and simple shapes' },
    { id: '3d', label: '3D Elements', prompt: '3D render elements isometric style' },
    { id: 'corporate', label: 'Business Professional', prompt: 'strictly professional corporate style' },
    { id: 'infographic', label: 'Standard Infographic', prompt: 'classic vector infographic style' },
];

const ASPECT_RATIOS = [
    { id: 'portrait_16_9', label: 'Long Vertical', description: '9:16 (Mobile/Story)', value: 'portrait_16_9' },
    { id: 'portrait_4_3', label: 'Poster', description: '3:4 (Print)', value: 'portrait_4_3' },
    { id: 'square_hd', label: 'Square', description: '1:1 (Post)', value: 'square_hd' },
    { id: 'landscape_16_9', label: 'Presentation', description: '16:9 (Slide)', value: 'landscape_16_9' },
];

const Infographic = () => {
    const navigate = useNavigate();
    const { user, credits, loading, refreshCredits } = useAuth();

    // Form state
    const [inforgraphicType, setInfographicType] = useState(INFOGRAPHIC_TYPES[0].id);
    const [topic, setTopic] = useState('');
    const [keyPoints, setKeyPoints] = useState('');
    const [structure, setStructure] = useState(''); // e.g., 5 steps, Pros vs Cons
    const [targetAudience, setTargetAudience] = useState('');

    const [colorTheme, setColorTheme] = useState(COLOR_THEMES[0]);
    const [customColor1, setCustomColor1] = useState('#3b82f6');
    const [customColor2, setCustomColor2] = useState('#1e293b');

    const [layoutStyle, setLayoutStyle] = useState(LAYOUT_STYLES[0]);
    const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
    const [resolution, setResolution] = useState(RESOLUTIONS[0]);

    // Manual Prompt Mode
    const [isManualPrompt, setIsManualPrompt] = useState(false);
    const [manualPrompt, setManualPrompt] = useState('');

    // UI state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [generatedData, setGeneratedData] = useState<any>(null); // To store full generation object for sharing
    const [showPreview, setShowPreview] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        if (!loading && !user) navigate('/auth');
    }, [user, loading, navigate]);

    const getColorPrompt = () => {
        if (colorTheme.id === 'custom') {
            return `custom color palette with primary ${customColor1} and secondary ${customColor2}`;
        }
        return colorTheme.prompt;
    };

    const composePrompt = () => {
        const typeLabel = INFOGRAPHIC_TYPES.find(t => t.id === inforgraphicType)?.label || 'Infographic';
        const typePrompt = INFOGRAPHIC_TYPES.find(t => t.id === inforgraphicType)?.prompt || '';

        let prompt = `Create a high-quality professional infographic. Type: ${typeLabel} (${typePrompt}). Topic: "${topic}".`;

        if (keyPoints) {
            prompt += ` Key points to cover: ${keyPoints}.`;
        }

        if (structure) {
            prompt += ` Structure/Layout: ${structure}.`;
        }

        if (targetAudience) {
            prompt += ` Target Audience: ${targetAudience}.`;
        }

        prompt += ` Visual Style: ${layoutStyle.prompt}.`;
        prompt += ` Color Theme: ${getColorPrompt()}.`;
        prompt += ` Ensure clear typography, readability, and professional grid layout.`;

        return prompt;
    };

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
                toast.error('Tulis prompt infografis terlebih dahulu');
                return;
            }
            finalPrompt = manualPrompt;
        } else {
            if (!topic.trim()) {
                toast.error('Topik infografis wajib diisi');
                return;
            }
            finalPrompt = composePrompt();
        }

        setIsGenerating(true);
        setGeneratedImage(null);
        setGeneratedData(null);

        try {
            const { data, error } = await supabase.functions.invoke('generate-ai', {
                body: {
                    type: 'image',
                    prompt: finalPrompt,
                    userId: user.id,
                    aspectRatio: aspectRatio.value,
                    resolution: resolution.id,
                },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            setGeneratedImage(data.url);
            setGeneratedData({ ...data, prompt: finalPrompt }); // Store data for publishing
            await refreshCredits();
            toast.success('Infografis berhasil dibuat!');
        } catch (error: any) {
            console.error('Generate error:', error);
            toast.error(error.message || 'Gagal membuat infografis');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!generatedImage) return;

        try {
            toast.info('Menyiapkan download...');
            const response = await fetch(generatedImage);
            if (!response.ok) throw new Error('Failed to fetch image');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `infographic-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Download berhasil!');
        } catch (error) {
            console.error('Download error:', error);
            window.open(generatedImage, '_blank');
            toast.info('Gambar dibuka di tab baru.');
        }
    };

    const handlePublish = async () => {
        if (!generatedData || !generatedData.id) return;

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
            <div className="mx-auto max-w-md md:max-w-3xl">
                <div className="mb-6 flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <FileOutput className="h-6 w-6 text-primary" />
                            Infografis Maker
                        </h1>
                        <p className="text-sm text-muted-foreground">Buat infografis kompleks & profesional dengan AI</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr,300px] gap-6">
                    <div className="space-y-4">
                        {/* Resolution Selector */}
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <Label className="font-semibold">Kualitas & Ukuran</Label>
                                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                                        {aspectRatio.label} ({resolution.label})
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select value={aspectRatio.id} onValueChange={(val) => setAspectRatio(ASPECT_RATIOS.find(r => r.id === val) || ASPECT_RATIOS[0])} disabled={isGenerating}>
                                        <SelectTrigger><SelectValue placeholder="Rasio" /></SelectTrigger>
                                        <SelectContent>
                                            {ASPECT_RATIOS.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={resolution.id} onValueChange={(val) => setResolution(RESOLUTIONS.find(r => r.id === val) || RESOLUTIONS[0])} disabled={isGenerating}>
                                        <SelectTrigger><SelectValue placeholder="Resolusi" /></SelectTrigger>
                                        <SelectContent>
                                            {RESOLUTIONS.map(r => <SelectItem key={r.id} value={r.id}>{r.label} (Rp {r.cost})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Manual Prompt Toggle */}
                        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
                            <Label htmlFor="manual-mode" className="cursor-pointer font-medium">Mode Prompt Manual</Label>
                            <div
                                className={cn(
                                    "w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200",
                                    isManualPrompt ? "bg-primary" : "bg-input"
                                )}
                                onClick={() => setIsManualPrompt(!isManualPrompt)}
                            >
                                <div className={cn("bg-background w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out", isManualPrompt ? "translate-x-6" : "")}></div>
                            </div>
                        </div>

                        {isManualPrompt ? (
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-base">Prompt Manual (English)</CardTitle></CardHeader>
                                <CardContent>
                                    <Textarea
                                        placeholder="Describe your infographic in detail..."
                                        rows={8}
                                        value={manualPrompt}
                                        onChange={(e) => setManualPrompt(e.target.value)}
                                        disabled={isGenerating}
                                    />
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {/* Auto Mode Fields */}
                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-base">Konten Utama</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Jenis Infografis</Label>
                                            <Select value={inforgraphicType} onValueChange={setInfographicType} disabled={isGenerating}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {INFOGRAPHIC_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Topik / Judul</Label>
                                            <Input
                                                placeholder="Contoh: Manfaat Teh Hijau, Sejarah Internet..."
                                                value={topic}
                                                onChange={(e) => setTopic(e.target.value)}
                                                disabled={isGenerating}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Poin-poin Utama (Opsional)</Label>
                                            <Textarea
                                                placeholder="Masukkan data, langkah-langkah, atau poin penting yang ingin ditampilkan..."
                                                rows={4}
                                                value={keyPoints}
                                                onChange={(e) => setKeyPoints(e.target.value)}
                                                disabled={isGenerating}
                                            />
                                        </div>
                                        <button
                                            className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground pt-2"
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                        >
                                            <span>Opsi Lanjutan (Target Audience, Style, Warna)</span>
                                            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>

                                        {showAdvanced && (
                                            <div className="space-y-4 pt-4 animate-in slide-in-from-top-2">
                                                <div className="space-y-2">
                                                    <Label>Target Audience</Label>
                                                    <Input placeholder="Contoh: Mahasiswa, Profesional, Anak-anak" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Layout Style</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {LAYOUT_STYLES.map(s => (
                                                            <Button
                                                                key={s.id}
                                                                size="sm"
                                                                variant={layoutStyle.id === s.id ? 'default' : 'outline'}
                                                                onClick={() => setLayoutStyle(s)}
                                                                className="text-xs h-7"
                                                            >
                                                                {s.label}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Tema Warna</Label>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {COLOR_THEMES.map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => setColorTheme(c)}
                                                                className={cn("h-8 rounded-md border-2 transition-all flex items-center justify-center", colorTheme.id === c.id ? "border-primary scale-105" : "border-transparent opacity-80 hover:opacity-100")}
                                                                style={c.id !== 'custom' ? {} : { background: '#eee' }}
                                                            >
                                                                {c.id !== 'custom' ? (
                                                                    <div className={cn("w-full h-full rounded", c.color)}></div>
                                                                ) : (
                                                                    <Palette className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}

                        {/* Generate Action */}
                        <Button className="w-full" size="lg" onClick={handleGenerate} disabled={isGenerating}>
                            {isGenerating ? <><Loader2 className="mr-2 animate-spin" /> Sedang Mendesain...</> : <><Sparkles className="mr-2" /> Buat Infografis (Rp {resolution.cost})</>}
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">Saldo kamu: Rp {credits.toLocaleString('id-ID')}</p>
                    </div>

                    {/* Right Column (Preview on Desktop, Bottom on Mobile) */}
                    <div className="space-y-4">
                        {generatedImage ? (
                            <Card className="border-green-500/50 sticky top-4">
                                <CardHeader className="pb-2"><CardTitle className="text-green-600 flex items-center gap-2"><Check className="h-4 w-4" /> Selesai!</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="relative group cursor-pointer rounded-lg overflow-hidden border" onClick={() => setShowPreview(true)}>
                                        <img src={generatedImage} alt="Result" className="w-full h-auto object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ZoomIn className="text-white" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" onClick={() => setShowPreview(true)}>Preview</Button>
                                        <Button onClick={handleDownload}><Download className="h-4 w-4 mr-2" /> Save</Button>
                                    </div>
                                    <Button variant="secondary" className="w-full" onClick={handlePublish}>
                                        <Compass className="h-4 w-4 mr-2" /> Publish to Explore
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="h-[200px] md:h-auto flex items-center justify-center border-dashed text-muted-foreground bg-muted/30">
                                <div className="text-center p-4">
                                    <FileOutput className="mx-auto h-12 w-12 opacity-20 mb-2" />
                                    <p className="text-sm">Preview akan muncul di sini</p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>

            {/* Fullscreen Preview */}
            {showPreview && generatedImage && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
                    <Button variant="ghost" className="absolute top-4 right-4 text-white hover:bg-white/10" onClick={() => setShowPreview(false)}><X /></Button>
                    <img src={generatedImage} className="max-w-full max-h-full rounded shadow-2xl" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default Infographic;
