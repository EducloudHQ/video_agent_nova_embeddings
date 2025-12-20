import { useState } from 'react'
import { UploadZone } from './components/UploadZone'
import { VideoFeed } from './components/VideoFeed'
import { Upload, Search, Film, LogOut, ChevronRight, Settings, Info } from 'lucide-react'
import { cn } from './lib/utils'
import { Authenticator, View, Text } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import loginIllustration from './assets/login_illustration.png'

type ViewName = 'upload' | 'feed'

const components = {
  Header() {
    return (
      <View textAlign="center" padding="2rem 1rem 1rem">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
            <Film className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">NovaAgent</h1>
        </div>
        <Text color="var(--amplify-colors-font-secondary)" fontSize="0.875rem" fontWeight="500">
          Smart Video Analysis Platform
        </Text>
      </View>
    );
  },
};

function AppMain({ signOut, user }: any) {
  const [currentView, setCurrentView] = useState<ViewName>('upload')
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null)

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-slate-900 font-sans">
      {/* Premium Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 mb-1">
             <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                <Film className="w-5 h-5 text-white" />
             </div>
             <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Nova<span className="text-indigo-600">Agent</span>
             </h1>
          </div>
          <p className="text-[10px] text-slate-400 font-bold tracking-[0.1em] uppercase mt-2">Workspace</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 pt-4">
          <button
            onClick={() => setCurrentView('upload')}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
              currentView === 'upload' 
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/50" 
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-3">
              <Upload className={cn("w-5 h-5", currentView === 'upload' ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
              <span>Upload Video</span>
            </div>
            {currentView === 'upload' && <ChevronRight className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setCurrentView('feed')}
            className={cn(
              "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
              currentView === 'feed' 
                 ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/50" 
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-3">
              <Search className={cn("w-5 h-5", currentView === 'feed' ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
              <span>Media Library</span>
            </div>
            {currentView === 'feed' && <ChevronRight className="w-4 h-4" />}
          </button>
        </nav>

        <div className="px-4 py-6 border-t border-slate-100 bg-slate-50/50 m-4 rounded-2xl border border-slate-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 shadow-sm">
                {user?.username?.substring(0, 2).toUpperCase() || 'AI'}
            </div>
             <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.signInDetails?.loginId || 'Video Agent'}</p>
                <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 mt-0.5">
                  PRO PLAN
                </div>
             </div>
          </div>
          
          <div className="space-y-1">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition-all text-[13px] font-medium border border-transparent hover:border-slate-200">
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-white transition-all text-[13px] font-medium border border-transparent hover:border-slate-200"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-white m-4 rounded-[2.5rem] border border-slate-200 shadow-[0_8px_40px_rgba(0,0,0,0.03)] relative">
        <div className="absolute top-0 right-0 p-8">
            <button className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">
                <Info className="w-5 h-5" />
            </button>
        </div>

        <div className="relative p-12 max-w-6xl mx-auto h-full flex flex-col">
            {notification && (
                <div className={cn(
                    "mb-8 p-4 rounded-2xl shadow-sm border animate-in slide-in-from-top duration-500 flex items-center gap-3",
                    notification.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                )}>
                    <div className={cn("w-2 h-2 rounded-full", notification.type === 'success' ? "bg-emerald-500" : "bg-rose-500")} />
                    <span className="font-semibold text-sm">{notification.message}</span>
                </div>
            )}
            
          <div className="flex-1">
            {currentView === 'upload' ? (
              <UploadZone setNotification={setNotification} />
            ) : (
              <VideoFeed />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Authenticator components={components}>
      {({ signOut, user }) => (
        <div className="h-screen w-screen overflow-hidden flex bg-white">
          {/* Left Design Panel */}
          <div className="hidden lg:flex flex-[1.2] flex-col justify-between p-12 bg-indigo-600 relative overflow-hidden">
            {/* Abstract Background pattern */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-400/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg">
                  <Film className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">NovaAgent</h2>
              </div>
              
              <div className="max-w-md">
                <h3 className="text-5xl font-bold text-white leading-tight mb-6">
                  The smartest way to <span className="text-sky-300">analyze</span> your video content.
                </h3>
                <p className="text-indigo-100 text-lg leading-relaxed font-medium">
                  Join thousands of creators using NovaAgent to automate their video processing workflows with state-of-the-art AI.
                </p>
              </div>
            </div>
            
            <div className="relative z-10 flex items-center justify-center -mb-20">
              <img 
                src={loginIllustration} 
                alt="NovaAgent Illustration" 
                className="w-full max-w-lg drop-shadow-2xl animate-float"
              />
            </div>
            
            <div className="relative z-10 flex items-center gap-6 text-indigo-100/60 text-sm font-medium">
              <span>NovaAgent © 2025</span>
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
          </div>

          {/* Main App Content */}
          <div className="flex-1 overflow-hidden">
            <AppMain signOut={signOut} user={user} />
          </div>
        </div>
      )}
    </Authenticator>
  );
}

