import { useState, useEffect } from 'react'
import { Search as SearchIcon, Play, Loader2, X, Check, XCircle } from 'lucide-react'
import { generateClient } from 'aws-amplify/api'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { VideoStatus } from '../types'

const onVideoStatusUpdate = /* GraphQL */ `
  subscription OnVideoStatusUpdate {
    onVideoStatusUpdate {
      requestId
      status
      message
      callbackId
      videoUrl
    }
  }
`;

const searchMutation = /* GraphQL */ `
  mutation Search($text: String!) {
    search(text: $text)
  }
`;

const approveMutation = /* GraphQL */ `
  mutation ApproveVideo($status: String!, $message: String, $callbackId: String!) {
    approveVideo(status: $status, message: $message, callbackId: $callbackId)
  }
`;



export function VideoFeed() {
  const client = generateClient()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<VideoStatus[]>([])
  const [activeVideo, setActiveVideo] = useState<string | null>(null)
  
  // Subscribe to updates
  useEffect(() => {
    // ... same logic
    console.log("Subscribing to updates...");
    const sub = (client.graphql({ query: onVideoStatusUpdate }) as any).subscribe({
      next: ({ data }: any) => {
        console.log("Received update:", data);
        const update = data.onVideoStatusUpdate as VideoStatus;
        if(update) {
            setResults(prev => {
                 if (update.videoUrl) {
                    if (prev.find(p => p.videoUrl === update.videoUrl)) return prev;
                    return [update, ...prev]
                }
                return prev;
            })
        }
      },
      error: (err: any) => console.error("Subscription error:", err)
    });

    return () => sub.unsubscribe();
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setSearching(true)
    setResults([]) 
    
    try {
      await client.graphql({
        query: searchMutation,
        variables: { text: query }
      });
    } catch (err) {
      console.error("Search failed:", err)
    } finally {
      setSearching(false)
    }
  }

  const handleApprove = async (e: React.MouseEvent, item: VideoStatus, status: 'APPROVED' | 'REJECTED') => {
      e.stopPropagation();
      if (!item.callbackId) return;

      try {
          await client.graphql({
              query: approveMutation,
              variables: {
                  status,
                  message: status === 'APPROVED' ? 'Video approved by user' : 'Video rejected by user',
                  callbackId: item.callbackId
              }
          });
          // Optimistic update
           setResults(prev => prev.map(p => p.callbackId === item.callbackId ? { ...p, status } : p))
      } catch (err) {
          console.error("Approval failed:", err);
      }
  }


  return (
    <div className="h-full flex flex-col space-y-10">
      {/* Header & Description */}
      <div className="flex flex-col space-y-3">
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Media <span className="text-indigo-600">Library</span>
        </h2>
        <p className="text-slate-500 text-lg font-medium max-w-2xl">
          Everything you need to manage and analyze your video content. Search for specific moments across your entire library.
        </p>
      </div>

      {/* Modern Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-2xl w-full group">
        <div className="absolute inset-0 bg-indigo-100 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
        <div className="relative bg-white border border-slate-200 rounded-2xl flex items-center p-2 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 transition-all duration-300">
            <SearchIcon className="ml-4 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
                type="text" 
                placeholder="Search for moments (e.g., 'sunset on a beach')..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-none text-slate-700 text-base placeholder:text-slate-400 focus:ring-0 px-4 py-2.5 font-medium"
            />
            <button 
                type="submit"
                disabled={searching || !query.trim()}
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
            >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search Library"}
            </button>
        </div>
      </form>

      {/* Results Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-32">
        {results.length === 0 && !searching && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 text-slate-400 space-y-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-slate-100">
                    <SearchIcon className="w-10 h-10 text-slate-200" />
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">No results to display</p>
                    <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto mt-1">Try searching for a keyword above or upload a new video to get started.</p>
                </div>
            </div>
        )}

        {results.map((item, idx) => (
            <div key={idx} className="group relative bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500">
                {/* Video Preview */}
                <div className="aspect-video bg-slate-900 relative flex items-center justify-center overflow-hidden group/preview">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent z-10" />
                    <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300 z-0" />
                    
                    <button 
                        className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl scale-90 opacity-0 group-hover/preview:scale-110 group-hover/preview:opacity-100 transition-all duration-300 cursor-pointer z-20 text-indigo-600 active:scale-95"
                        onClick={() => item.videoUrl && setActiveVideo(item.videoUrl)} 
                    >
                        <Play className="w-5 h-5 fill-current ml-1" />
                    </button>
                    <FilmWrapper url={item.videoUrl} />
                </div>

                {/* Card Body */}
                <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-4 mb-auto">
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 truncate mb-1" title={item.requestId}>
                                Video Analysis #{idx + 1}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border",
                                    item.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                    item.status === 'REJECTED' ? "bg-rose-50 text-rose-700 border-rose-100" :
                                    "bg-blue-50 text-blue-700 border-blue-100"
                                )}>
                                    {item.status}
                                </span>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors cursor-pointer border border-slate-100">
                            <Check className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Actions if pending */}
                    {item.callbackId && (item.status !== 'APPROVED' && item.status !== 'REJECTED') && (
                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <button 
                                onClick={(e) => handleApprove(e, item, 'APPROVED')}
                                className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
                            >
                                <Check className="w-4 h-4" /> Approve
                            </button>
                            <button 
                                onClick={(e) => handleApprove(e, item, 'REJECTED')}
                                className="flex items-center justify-center gap-2 bg-white text-slate-900 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all active:scale-95"
                            >
                                <XCircle className="w-4 h-4 text-rose-500" /> Reject
                            </button>
                        </div>
                    )}
                </div>
            </div>
        ))}
      </div>

      {/* Enhanced Video Player Modal */}
      <AnimatePresence>
      {activeVideo && (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-8 overflow-hidden" 
            onClick={() => setActiveVideo(null)}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="relative w-full max-w-6xl aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/20" 
                onClick={e => e.stopPropagation()}
            >
                <video 
                    src={activeVideo} 
                    controls 
                    autoPlay 
                    className="w-full h-full object-contain"
                />
                <button 
                    onClick={() => setActiveVideo(null)}
                    className="absolute top-6 right-6 bg-white/10 text-white p-3 rounded-full hover:bg-white/20 transition-all backdrop-blur-xl border border-white/20"
                >
                    <X className="w-6 h-6" />
                </button>
            </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

function FilmWrapper({ url }: { url?: string }) {
    if (!url) return null;
    return (
        <video 
          src={url} 
          className="absolute inset-0 w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 ease-out scale-105 group-hover:scale-100" 
        />
    )
}

