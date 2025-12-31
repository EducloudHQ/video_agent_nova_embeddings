import React, { useState } from 'react';
import { 
  LogOut, 
  Upload, 
  Video as VideoIcon, 
  User as UserIcon, 
  Menu,
  Sun,
  Moon,
} from 'lucide-react';
import { AppView } from './types';
import { Button, Card } from './components/UI';
import { UploadZone } from './components/UploadZone';
import { VideoFeed } from './components/VideoFeed';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import amplifyConfig from './amplify-config';

// Configure Amplify
Amplify.configure(amplifyConfig);

const authComponents = {
  Header() {
    return (
      <div className="flex flex-col items-center mb-8 pt-8">
        <div className="h-12 w-12 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center mb-4">
          <VideoIcon className="text-[hsl(var(--primary-foreground))] h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">NovaAgent</h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm">Smart Video Analysis Platform</p>
      </div>
    );
  },
};

export default function App() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className={isDark ? 'dark' : ''}>
      <Authenticator components={authComponents}>
        {({ signOut, user }) => (
          <AuthenticatedApp 
            signOut={signOut!} 
            user={user!} 
            isDark={isDark} 
            toggleTheme={() => setIsDark(!isDark)} 
          />
        )}
      </Authenticator>
    </div>
  );
}

function AuthenticatedApp({ 
  signOut, 
  user, 
  isDark, 
  toggleTheme 
}: { 
  signOut: () => void, 
  user: any,
  isDark: boolean,
  toggleTheme: () => void
}) {
  const [view, setView] = useState<AppView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex font-sans text-[hsl(var(--foreground))]">
      {/* Sidebar */}
      <aside className={`bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} flex flex-col z-20`}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-[hsl(var(--primary))] p-1.5 rounded-md min-w-[32px]">
            <VideoIcon className="text-[hsl(var(--primary-foreground))] h-5 w-5" />
          </div>
          {sidebarOpen && <span className="font-bold text-lg tracking-tight">NovaAgent</span>}
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <NavItem 
            icon={<Upload className="h-5 w-5" />} 
            label="Upload Video" 
            active={view === 'upload'} 
            collapsed={!sidebarOpen}
            onClick={() => setView('upload')}
          />
          <NavItem 
            icon={<VideoIcon className="h-5 w-5" />} 
            label="Media Library" 
            active={view === 'dashboard'} 
            collapsed={!sidebarOpen}
            onClick={() => setView('dashboard')}
          />
        </nav>

        <div className="p-4 border-t border-[hsl(var(--border))]">
          <NavItem 
            icon={<LogOut className="h-5 w-5" />} 
            label="Sign Out" 
            collapsed={!sidebarOpen}
            onClick={signOut}
            variant="danger"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Navbar */}
        <header className="h-16 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            
            {view === 'dashboard' && (
                <div className="hidden sm:block text-sm font-medium text-[hsl(var(--muted-foreground))]">
                   Media Library Overview
                </div>
            )}
            {view === 'upload' && (
                <div className="hidden sm:block text-sm font-medium text-[hsl(var(--muted-foreground))]">
                   Upload New Content
                </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{user.username || user.signInDetails?.loginId}</p>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] mt-0.5">
                  PRO USER
              </div>
            </div>
            <div className="h-10 w-10 rounded-full bg-[hsl(var(--secondary))] flex items-center justify-center border border-[hsl(var(--border))] shadow-sm">
              <UserIcon className="h-5 w-5 text-[hsl(var(--foreground))]" />
            </div>
          </div>
        </header>

        {/* Dynamic View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {notification && (
                <Card className={`p-4 flex items-center gap-3 border-l-4 ${notification.type === 'success' ? 'border-l-green-500 bg-green-50/50' : 'border-l-red-500 bg-red-50/50'}`}>
                    <div className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{notification.message}</p>
                </Card>
            )}

            {view === 'upload' ? (
                <UploadZone setNotification={setNotification} onUploadComplete={() => setView('dashboard')} />
            ) : (
                <VideoFeed />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const NavItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  collapsed?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'danger';
}> = ({ 
  icon, 
  label, 
  active = false, 
  collapsed = false, 
  onClick,
  variant = 'default'
}) => {
  const base = "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all text-sm font-medium cursor-pointer";
  const activeStyles = active 
    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md shadow-[hsl(var(--primary)/0.2)]" 
    : variant === 'danger' 
      ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950" 
      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]";

  return (
    <div className={`${base} ${activeStyles}`} onClick={onClick}>
      {icon}
      {!collapsed && <span>{label}</span>}
    </div>
  );
}
