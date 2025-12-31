import React, { useState, useEffect } from 'react'
import { Search as SearchIcon, Play, Loader2, X, Check, XCircle, Clock, Eye } from 'lucide-react'
import { generateClient } from 'aws-amplify/api'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { VideoStatus } from '../types'
import { Button, Input, Card, Badge } from './UI'

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
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[hsl(var(--foreground))]">
            {query ? `Results for "${query}"` : 'Your Media Library'}
          </h2>
          <p className="text-[hsl(var(--muted-foreground))]">Manage and analyze your processed video content.</p>
        </div>

        <form onSubmit={handleSearch} className="max-w-md w-full relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input 
            placeholder="Search moments with AI..." 
            className="pl-10 h-10 bg-[hsl(var(--secondary))] border-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 text-[hsl(var(--muted-foreground))] animate-spin" />
            </div>
          )}
        </form>
      </div>

      {searching ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--primary))]"></div>
          <p className="text-[hsl(var(--muted-foreground))] font-medium italic">NovaAgent is searching for relevant context...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {results.map((video, idx) => (
            <Card key={idx} className="group overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-[hsl(var(--secondary))] overflow-hidden" onClick={() => video.videoUrl && setActiveVideo(video.videoUrl)}>
                {video.videoUrl ? (
                    <video 
                        src={video.videoUrl} 
                        className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 ease-out" 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
                        <Play className="h-12 w-12 opacity-20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="h-12 w-12 bg-[hsl(var(--card))] rounded-full flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <Play className="h-5 w-5 text-[hsl(var(--foreground))] ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <Badge className={cn(
                    video.status === 'APPROVED' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                    video.status === 'REJECTED' ? "bg-red-500/10 text-red-600 border-red-500/20" :
                    "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/20"
                  )}>
                    {video.status}
                  </Badge>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Video #{idx + 1}</span>
                </div>
                
                <h3 className="font-semibold text-[hsl(var(--foreground))] line-clamp-1">Analysis for {video.requestId.substring(0, 8)}...</h3>
                
                {video.callbackId && (video.status !== 'APPROVED' && video.status !== 'REJECTED') && (
                    <div className="flex gap-2 pt-2">
                        <Button 
                            variant="primary" 
                            size="sm" 
                            className="flex-1 gap-1.5"
                            onClick={(e) => handleApprove(e, video, 'APPROVED')}
                        >
                            <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-100 dark:border-red-900/30"
                            onClick={(e) => handleApprove(e, video, 'REJECTED')}
                        >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                    </div>
                )}

                <div className="pt-2 flex items-center gap-4 border-t border-[hsl(var(--border))]">
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <Eye className="h-3 w-3" />
                    {video.status === 'APPROVED' ? 'Visible' : 'Pending'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <Clock className="h-3 w-3" />
                    Just now
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-[hsl(var(--card))] rounded-xl border border-dashed border-[hsl(var(--border))]">
          <SearchIcon className="h-12 w-12 text-[hsl(var(--muted-foreground))] opacity-50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No results found</h3>
          <p className="text-[hsl(var(--muted-foreground))]">Try a different search or upload a new video to get started.</p>
        </div>
      )}

      {/* Video Player Modal */}
      <AnimatePresence>
      {activeVideo && (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[hsl(var(--background))]/90 backdrop-blur-sm p-4 sm:p-8" 
            onClick={() => setActiveVideo(null)}
        >
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl" 
                onClick={e => e.stopPropagation()}
            >
                <video 
                    src={activeVideo} 
                    controls 
                    autoPlay 
                    className="w-full h-full"
                />
                <button 
                    onClick={() => setActiveVideo(null)}
                    className="absolute top-4 right-4 bg-white/10 text-white p-2 rounded-full hover:bg-white/20 transition-all backdrop-blur-md"
                >
                    <X className="w-5 h-5" />
                </button>
            </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
