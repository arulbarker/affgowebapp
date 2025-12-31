import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, Star, Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const packages = [
  {
    id: 'iseng',
    name: 'Paket Iseng',
    amount: 15000,
    description: 'Cocok untuk coba-coba',
    icon: Zap,
    popular: false,
    features: ['10x Buat Poster', '2x Hidupkan Foto'],
  },
  {
    id: 'kreator',
    name: 'Paket Kreator',
    amount: 50000,
    description: 'Untuk kreator aktif',
    icon: Star,
    popular: true,
    features: ['33x Buat Poster', '8x Hidupkan Foto'],
  },
  {
    id: 'sultan',
    name: 'Paket Sultan',
    amount: 100000,
    description: 'Unlimited creativity',
    icon: Crown,
    popular: false,
    features: ['66x Buat Poster', '16x Hidupkan Foto'],
  },
];

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const TopUp = () => {
  const navigate = useNavigate();
  const { user, credits, loading } = useAuth();
  const [processingPackage, setProcessingPackage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleTopUp = async (packageId: string, amount: number) => {
    if (!user) {
      toast.error('Silakan masuk terlebih dahulu');
      navigate('/auth');
      return;
    }

    setProcessingPackage(packageId);

    try {
      const { data, error } = await supabase.functions.invoke('create-midtrans-token', {
        body: { amount, userId: user.id },
      });

      if (error) throw error;

      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        throw new Error('Tidak dapat membuat link pembayaran');
      }
    } catch (error: any) {
      console.error('TopUp error:', error);
      toast.error('Gagal memproses pembayaran: ' + error.message);
    } finally {
      setProcessingPackage(null);
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
      <div className="mx-auto max-w-md md:max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Top Up Saldo</h1>
            <p className="text-sm text-muted-foreground">
              Saldo kamu: {formatRupiah(credits)}
            </p>
          </div>
        </div>

        {/* Packages */}
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <Card
                key={pkg.id}
                className={`relative overflow-hidden transition-all hover:shadow-lg ${
                  pkg.popular ? 'border-primary' : ''
                }`}
              >
                {pkg.popular && (
                  <Badge className="absolute right-3 top-3">Populer</Badge>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      <CardDescription>{pkg.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p className="text-2xl font-bold text-primary">
                      {formatRupiah(pkg.amount)}
                    </p>
                  </div>
                  <ul className="mb-4 space-y-1 text-sm text-muted-foreground">
                    {pkg.features.map((feature, idx) => (
                      <li key={idx}>✓ {feature}</li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    onClick={() => handleTopUp(pkg.id, pkg.amount)}
                    disabled={processingPackage !== null}
                  >
                    {processingPackage === pkg.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      'Beli Sekarang'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TopUp;
