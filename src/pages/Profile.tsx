import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Mail, Wallet, History, LogOut, Loader2 } from 'lucide-react';
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
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, credits, loading, signOut } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loadingGenerations, setLoadingGenerations] = useState(true);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
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
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted">
                      {gen.type === 'image' && gen.image_url && (
                        <img
                          src={gen.image_url}
                          alt="Generated"
                          className="h-full w-full object-cover"
                        />
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
                      <p className="text-xs text-muted-foreground">
                        {new Date(gen.created_at).toLocaleDateString('id-ID')}
                      </p>
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
    </div>
  );
};

export default Profile;
