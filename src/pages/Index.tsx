import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image, Video, ArrowRight, Loader2, FileOutput } from 'lucide-react';
import { useEffect } from 'react';
import affGoLogo from '@/assets/aff-go-logo.jpg';

const features = [
  {
    path: '/video',
    title: 'Hidupkan Foto',
    description: 'Ubah foto jadi video yang bergerak',
    icon: Video,
    price: 'Mulai Rp 7.500/video',
    color: 'bg-primary/10 text-primary',
  },
  {
    path: '/infographic',
    title: 'Buat Infografis',
    description: 'Data dan informasi jadi visual profesional',
    icon: FileOutput,
    price: 'Mulai Rp 3.000/gambar',
    color: 'bg-primary/10 text-primary',
  },
  {
    path: '/poster',
    title: 'Buat Poster',
    description: 'Bikin poster anti typo dengan AI',
    icon: Image,
    price: 'Mulai Rp 3.000/gambar',
    color: 'bg-primary/10 text-primary',
  },
];

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24 md:pb-8">
      <div className="mx-auto max-w-md md:max-w-6xl">
        {/* Hero */}
        <div className="mb-6 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-6">
          <div className="mb-3 flex items-center gap-3">
            <img src={affGoLogo} alt="Affiliate Go Pro Logo" className="h-16 w-auto rounded-lg" />
            <h1 className="text-2xl font-bold">Selamat Datang di Affiliate Go Pro!</h1>
          </div>
          <p className="text-muted-foreground">
            Buat konten viral dengan bantuan AI. Tanpa ribet, tanpa typo.
          </p>
        </div>

        {/* Features */}
        <h2 className="mb-4 text-lg font-semibold">Fitur Tersedia</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.path}
                className="cursor-pointer transition-all hover:shadow-md"
                onClick={() => navigate(feature.path)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-lg p-3 ${feature.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                    <p className="mt-1 text-xs font-medium text-primary">
                      {feature.price}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Top Up */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Saldo Habis?</CardTitle>
            <CardDescription>Top up sekarang dan mulai berkarya</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/topup')}>
              Top Up Saldo
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
