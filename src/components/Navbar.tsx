import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Wallet, User, Home, Image, Video, Compass, FileOutput } from 'lucide-react';
import affGoLogo from '@/assets/aff-go-logo.jpg';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

const desktopNavItems = [
  { path: '/', label: 'Beranda', icon: Home },
  { path: '/explore', label: 'Explore', icon: Compass },
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, credits } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <div
            className="flex cursor-pointer items-center gap-2"
            onClick={() => navigate('/')}
          >
            <img src={affGoLogo} alt="Affiliate Go Pro Logo" className="h-8 w-auto" />
            <span className="font-bold">Affiliate Go Pro</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/topup')}
              className="gap-1"
            >
              <Wallet className="h-4 w-4" />
              <span className="text-xs">{formatRupiah(credits)}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/profile')}
            >
              <User className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => navigate('/auth')}>
            Masuk
          </Button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
