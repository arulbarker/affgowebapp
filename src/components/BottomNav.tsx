import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Image, Video, User, Compass } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Beranda', icon: Home },
  { path: '/poster', label: 'Poster', icon: Image },
  { path: '/video', label: 'Video', icon: Video },
  { path: '/explore', label: 'Explore', icon: Compass },
  { path: '/profile', label: 'Profil', icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="mx-auto flex max-w-md justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors ${isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
