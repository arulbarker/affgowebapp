import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Mail, Wallet, History, LogOut, Loader2, Compass, Share2, Download, X, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

interface Generation {
  id: string;
  type: string;
  prompt: string | null;
  cost: number;
  created_at: string;
  image_url: string | null;
  video_url: string | null;
  is_public?: boolean;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, credits, loading, signOut } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(true);
  const [selectedGen, setSelectedGen] = useState<Generation | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchGenerations = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setGenerations(data);
      }
      setLoadingGenerations(false);
    };

    if (user) {
      fetchGenerations();
    }
  }, [user]);

  const handlePublish = async (gen: Generation) => {
    if (gen.type !== 'image') {
      toast.error('Hanya poster yang bisa dipublish ke Explore');
      return;
    }

    try {
      const newStatus = !gen.is_public;
      console.log('Publishing generation:', gen.id, 'new status:', newStatus);

      const { error, data } = await supabase
        .from('generations')
        .update({ is_public: newStatus })
        .eq('id', gen.id)
        .select();

      console.log('Publish result:', { error, data });

      if (error) throw error;

      setGenerations(prev => prev.map(g =>
        g.id === gen.id ? { ...g, is_public: newStatus } : g
      ));

      // Also update selectedGen if it's the same generation
      if (selectedGen?.id === gen.id) {
        setSelectedGen({ ...selectedGen, is_public: newStatus });
      }

      toast.success(newStatus ? 'Poster berhasil dipublish ke Explore' : 'Poster dihapus dari Explore');
    } catch (error: any) {
      console.error('Publish error:', error);
      toast.error('Gagal mengupdate status publish: ' + (error.message || 'Unknown error'));
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDownload = async (url: string | null) => {
    if (!url) return;
    try {
      toast.info('Menyiapkan download...');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `poster-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      toast.success('Download berhasil!');
    } catch (error) {
      console.error('Download error:', error);
      window.open(url, '_blank');
      toast.info('Dibuka di tab baru (Klik Kanan > Save Image As)');
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
            <h1 className="text-xl font-bold">Profil</h1>
            <p className="text-sm text-muted-foreground">Kelola akun kamu</p>
          </div>
        </div>

        {/* Profile Info */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Informasi Akun
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">{user?.email}</p>
                <p className="text-sm text-muted-foreground">Member sejak {new Date(user?.created_at || '').toLocaleDateString('id-ID')}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span>Saldo</span>
              </div>
              <span className="text-lg font-bold text-primary">{formatRupiah(credits)}</span>
            </div>

            <Button className="w-full" onClick={() => navigate('/topup')}>
              Top Up Saldo
            </Button>
          </CardContent>
        </Card>

        {/* Generation History */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-primary" />
              Riwayat Generasi
            </CardTitle>
            <CardDescription>10 generasi terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingGenerations ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : generations.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Belum ada riwayat generasi
              </p>
            ) : (
              <div className="space-y-3">
                {generations.map((gen) => (
                  <div
                    key={gen.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => gen.type === 'image' && setSelectedGen(gen)}
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted relative">
                      {gen.type === 'image' && gen.image_url && (
                        <>
                          <img
                            src={gen.image_url}
                            alt="Generated"
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <ZoomIn className="h-4 w-4 text-white" />
                          </div>
                        </>
                      )}
                      {gen.type === 'video' && (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Video
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium capitalize">
                        {gen.type === 'image' ? 'Poster' : 'Video'}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {gen.prompt || 'No prompt'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-primary">
                        -{formatRupiah(gen.cost)}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(gen.created_at).toLocaleDateString('id-ID')}
                      </p>
                      {gen.type === 'image' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 text-[10px] ${gen.is_public ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                          onClick={() => handlePublish(gen)}
                        >
                          <Compass className="mr-1 h-3 w-3" />
                          {gen.is_public ? 'Posted' : 'Share'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Keluar
        </Button>
      </div>

      {/* Detail Modal */}
      {
        selectedGen && (
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
              className="relative max-w-4xl w-full flex flex-col items-center gap-4"
              onClick={e => e.stopPropagation()}
            >
              {selectedGen.type === 'image' && selectedGen.image_url && (
                <img
                  src={selectedGen.image_url}
                  alt={selectedGen.prompt || 'Generated Image'}
                  className="max-h-[80vh] w-auto rounded-lg shadow-2xl"
                />
              )}

              <div className="flex gap-3 w-full justify-center">
                <Button onClick={() => handleDownload(selectedGen.image_url)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download HD
                </Button>
                <Button
                  variant={selectedGen.is_public ? "secondary" : "default"}
                  onClick={() => handlePublish(selectedGen)}
                >
                  <Compass className="mr-2 h-4 w-4" />
                  {selectedGen.is_public ? 'Unpublish' : 'Publish to Explore'}
                </Button>
              </div>

              {selectedGen.prompt && (
                <div className="bg-black/50 p-4 rounded-lg text-white text-center max-w-2xl backdrop-blur-sm">
                  <p className="text-sm font-medium opacity-80 mb-1">Prompt:</p>
                  <p className="text-sm">{selectedGen.prompt}</p>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Profile;
