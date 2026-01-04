import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Compass, Heart, Copy, Download, Loader2, Share2, X, Image, FileOutput, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const [selectedGen, setSelectedGen] = useState<PublicGeneration | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 12;

    // Helper function to detect content type from prompt
    const getContentType = (prompt: string): 'poster' | 'infographic' => {
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('infographic') || lowerPrompt.includes('infografis') ||
            lowerPrompt.includes('timeline') || lowerPrompt.includes('data visualization') ||
            lowerPrompt.includes('chart') || lowerPrompt.includes('graph') ||
            lowerPrompt.includes('process') || lowerPrompt.includes('resume') ||
            lowerPrompt.includes('listicle') || lowerPrompt.includes('comparison')) {
            return 'infographic';
        }
        return 'poster';
    };

    useEffect(() => {
        fetchGenerations();
    }, [sort, user, currentPage]);

    // Reset to page 1 when sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [sort]);

    const fetchGenerations = async () => {
        setLoading(true);
        try {
            // First get total count
            const { count } = await supabase
                .from('generations')
                .select('*', { count: 'exact', head: true })
                .eq('is_public', true)
                .eq('type', 'image');

            setTotalCount(count || 0);

            // Calculate range for pagination
            const from = (currentPage - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

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

            const { data, error } = await query.range(from, to);

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

    const totalPages = Math.ceil(totalCount / itemsPerPage);

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
                        {generations.map((gen) => {
                            const contentType = getContentType(gen.prompt);
                            return (
                                <Card key={gen.id} className="break-inside-avoid overflow-hidden border-muted group mb-4 cursor-pointer" onClick={() => setSelectedGen(gen)}>
                                    <div className="relative aspect-auto">
                                        {gen.image_url && (
                                            <img
                                                src={gen.image_url}
                                                alt={gen.prompt}
                                                className="w-full h-auto object-cover"
                                                loading="lazy"
                                            />
                                        )}
                                        {/* Type Badge */}
                                        <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 ${contentType === 'infographic'
                                            ? 'bg-blue-500/90 text-white'
                                            : 'bg-green-500/90 text-white'
                                            }`}>
                                            {contentType === 'infographic' ? (
                                                <><FileOutput className="h-3 w-3" /> Infografis</>
                                            ) : (
                                                <><Image className="h-3 w-3" /> Poster</>
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button
                                                size="icon"
                                                variant="secondary"
                                                className="rounded-full h-10 w-10"
                                                onClick={(e) => { e.stopPropagation(); setSelectedGen(gen); }}
                                            >
                                                <ZoomIn className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="secondary"
                                                className="rounded-full h-10 w-10"
                                                onClick={(e) => { e.stopPropagation(); handleDownload(gen.image_url, gen.id); }}
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
                                                onClick={(e) => { e.stopPropagation(); handleLike(gen); }}
                                            >
                                                <Heart className={`h-4 w-4 ${gen.is_liked_by_user ? 'fill-current' : ''}`} />
                                                <span className="text-xs">{gen.likes_count}</span>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1 px-2 text-muted-foreground"
                                                onClick={(e) => { e.stopPropagation(); copyPrompt(gen.prompt); }}
                                            >
                                                <Copy className="h-3 w-3" />
                                                <span className="text-xs">Copy</span>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8 pb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1 || loading}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Prev
                        </Button>

                        <div className="flex items-center gap-1">
                            {/* Show first page */}
                            {currentPage > 3 && (
                                <>
                                    <Button
                                        variant={currentPage === 1 ? "default" : "outline"}
                                        size="sm"
                                        className="w-9 h-9 p-0"
                                        onClick={() => setCurrentPage(1)}
                                    >
                                        1
                                    </Button>
                                    {currentPage > 4 && <span className="text-muted-foreground px-1">...</span>}
                                </>
                            )}

                            {/* Show surrounding pages */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(page => {
                                    const diff = Math.abs(page - currentPage);
                                    return diff <= 2;
                                })
                                .map(page => (
                                    <Button
                                        key={page}
                                        variant={currentPage === page ? "default" : "outline"}
                                        size="sm"
                                        className="w-9 h-9 p-0"
                                        onClick={() => setCurrentPage(page)}
                                        disabled={loading}
                                    >
                                        {page}
                                    </Button>
                                ))
                            }

                            {/* Show last page */}
                            {currentPage < totalPages - 2 && (
                                <>
                                    {currentPage < totalPages - 3 && <span className="text-muted-foreground px-1">...</span>}
                                    <Button
                                        variant={currentPage === totalPages ? "default" : "outline"}
                                        size="sm"
                                        className="w-9 h-9 p-0"
                                        onClick={() => setCurrentPage(totalPages)}
                                    >
                                        {totalPages}
                                    </Button>
                                </>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages || loading}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Total count display */}
                {totalCount > 0 && (
                    <p className="text-center text-sm text-muted-foreground mt-2">
                        Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} dari {totalCount} karya
                    </p>
                )}
            </div>

            {/* Preview Modal */}
            {selectedGen && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedGen(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                        onClick={() => setSelectedGen(null)}
                    >
                        <X className="h-8 w-8" />
                    </button>

                    <div
                        className="relative max-w-5xl w-full flex flex-col md:flex-row gap-6 items-start"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Image */}
                        {selectedGen.image_url && (
                            <div className="flex-1 flex items-center justify-center">
                                <img
                                    src={selectedGen.image_url}
                                    alt={selectedGen.prompt}
                                    className="max-h-[80vh] w-auto rounded-lg shadow-2xl"
                                />
                            </div>
                        )}

                        {/* Details Panel */}
                        <div className="w-full md:w-80 bg-background/95 backdrop-blur-sm rounded-lg p-5 space-y-4">
                            {/* Type Badge */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getContentType(selectedGen.prompt) === 'infographic'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-green-500/20 text-green-400'
                                }`}>
                                {getContentType(selectedGen.prompt) === 'infographic' ? (
                                    <><FileOutput className="h-4 w-4" /> Infografis</>
                                ) : (
                                    <><Image className="h-4 w-4" /> Poster</>
                                )}
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Heart className={`h-4 w-4 ${selectedGen.is_liked_by_user ? 'fill-red-500 text-red-500' : ''}`} />
                                    {selectedGen.likes_count} likes
                                </span>
                                <span>
                                    {new Date(selectedGen.created_at).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>

                            {/* Prompt */}
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Prompt:</p>
                                <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">
                                    {selectedGen.prompt}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 pt-2">
                                <Button onClick={() => handleDownload(selectedGen.image_url, selectedGen.id)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download HD
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => copyPrompt(selectedGen.prompt)}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy Prompt
                                </Button>
                                <Button
                                    variant={selectedGen.is_liked_by_user ? "default" : "outline"}
                                    onClick={() => handleLike(selectedGen)}
                                    className={selectedGen.is_liked_by_user ? 'bg-red-500 hover:bg-red-600' : ''}
                                >
                                    <Heart className={`mr-2 h-4 w-4 ${selectedGen.is_liked_by_user ? 'fill-current' : ''}`} />
                                    {selectedGen.is_liked_by_user ? 'Liked' : 'Like'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Explore;

