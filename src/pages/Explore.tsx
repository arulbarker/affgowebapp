import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Compass, Heart, Copy, Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface PublicGeneration {
    id: string;
    image_url: string | null;
    prompt: string;
    likes_count: number;
    created_at: string;
    is_liked_by_user?: boolean;
}

const Explore = () => {
    const { user } = useAuth();
    const [generations, setGenerations] = useState<PublicGeneration[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState('newest');
    const [likingId, setLikingId] = useState<string | null>(null);

    useEffect(() => {
        fetchGenerations();
    }, [sort, user]);

    const fetchGenerations = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('generations')
                .select('*')
                .eq('is_public', true)
                .eq('type', 'image');

            if (sort === 'popular') {
                query = query.order('likes_count', { ascending: false });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query.limit(50);

            if (error) throw error;

            // If user is logged in, check which ones they liked
            let generationsWithLikes = data || [];

            if (user && data && data.length > 0) {
                const { data: likes } = await supabase
                    .from('generation_likes')
                    .select('generation_id')
                    .eq('user_id', user.id)
                    .in('generation_id', data.map(g => g.id));

                const likedIds = new Set(likes?.map(l => l.generation_id));

                generationsWithLikes = data.map(g => ({
                    ...g,
                    is_liked_by_user: likedIds.has(g.id)
                }));
            }

            setGenerations(generationsWithLikes);
        } catch (error) {
            console.error('Error fetching explore:', error);
            toast.error('Gagal memuat galeri explore');
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (gen: PublicGeneration) => {
        if (!user) {
            toast.error('Silakan login untuk menyukai');
            return;
        }

        if (likingId) return;
        setLikingId(gen.id);

        try {
            if (gen.is_liked_by_user) {
                // Unlike
                const { error } = await supabase
                    .from('generation_likes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('generation_id', gen.id);

                if (error) throw error;

                setGenerations(prev => prev.map(g =>
                    g.id === gen.id
                        ? { ...g, is_liked_by_user: false, likes_count: Math.max(0, g.likes_count - 1) }
                        : g
                ));
            } else {
                // Like
                const { error } = await supabase
                    .from('generation_likes')
                    .insert({ user_id: user.id, generation_id: gen.id });

                if (error) throw error;

                setGenerations(prev => prev.map(g =>
                    g.id === gen.id
                        ? { ...g, is_liked_by_user: true, likes_count: g.likes_count + 1 }
                        : g
                ));
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            toast.error('Gagal memproses like');
        } finally {
            setLikingId(null);
        }
    };

    const copyPrompt = (prompt: string) => {
        navigator.clipboard.writeText(prompt);
        toast.success('Prompt disalin ke clipboard');
    };

    const handleDownload = async (url: string | null, id: string) => {
        if (!url) return;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `affgo-explore-${id}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (error) {
            toast.error('Gagal mendownload gambar');
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 pb-24 md:pb-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Compass className="h-6 w-6 text-primary" />
                            Explore
                        </h1>
                        <p className="text-muted-foreground">Temukan inspirasi dari kreator lain</p>
                    </div>
                </div>

                <Tabs defaultValue="newest" value={sort} onValueChange={setSort} className="mb-8">
                    <TabsList>
                        <TabsTrigger value="newest">Terbaru</TabsTrigger>
                        <TabsTrigger value="popular">Terpopuler</TabsTrigger>
                    </TabsList>
                </Tabs>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : generations.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        Belum ada karya yang dibagikan
                    </div>
                ) : (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                        {generations.map((gen) => (
                            <Card key={gen.id} className="break-inside-avoid overflow-hidden border-muted group mb-4">
                                <div className="relative aspect-auto">
                                    {gen.image_url && (
                                        <img
                                            src={gen.image_url}
                                            alt={gen.prompt}
                                            className="w-full h-auto object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="rounded-full h-10 w-10"
                                            onClick={() => handleDownload(gen.image_url, gen.id)}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <CardContent className="p-3">
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3 font-mono text-xs">
                                        {gen.prompt}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`gap-1 px-2 ${gen.is_liked_by_user ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'}`}
                                            onClick={() => handleLike(gen)}
                                        >
                                            <Heart className={`h-4 w-4 ${gen.is_liked_by_user ? 'fill-current' : ''}`} />
                                            <span className="text-xs">{gen.likes_count}</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1 px-2 text-muted-foreground"
                                            onClick={() => copyPrompt(gen.prompt)}
                                        >
                                            <Copy className="h-3 w-3" />
                                            <span className="text-xs">Copy</span>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Explore;
