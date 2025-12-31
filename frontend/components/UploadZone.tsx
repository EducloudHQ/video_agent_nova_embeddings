import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X } from 'lucide-react'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/api'
import { getUploadUrl } from '../graphql/mutations'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import { Button, Card, Progress } from './UI'

interface UploadZoneProps {
    setNotification: (n: {message: string, type: 'success' | 'error'} | null) => void
    onUploadComplete?: () => void
}

export function UploadZone({ setNotification, onUploadComplete }: UploadZoneProps) {
  const client = generateClient()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    try {
      console.log('Current Config before upload:', Amplify.getConfig())
      // 1. Get Presigned URL via GraphQL
      const response = await client.graphql({
        query: getUploadUrl,
        authMode: 'userPool' as any,
        variables: {
          fileName: file.name,
          contentType: file.type || 'video/mp4'
        }
      })

      const { url } = (response as any).data.getUploadUrl

      // 2. Upload to S3 using XMLHttpRequest for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setProgress(percentComplete)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response)
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

        xhr.open('PUT', url)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
        xhr.send(file)
      })
      
      console.log('Upload success')
      setNotification({ message: `Successfully uploaded ${file.name}`, type: 'success' })
      if (onUploadComplete) onUploadComplete()
      
    } catch (error) {
      console.error('Error uploading file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload'
       setNotification({ message: `Upload failed: ${errorMessage}`, type: 'error' })
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [setNotification, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': []
    },
    maxFiles: 1,
    disabled: uploading,
    multiple: undefined,
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined
  })

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div 
        {...getRootProps()}
        className={cn(
          "relative h-[400px] rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center p-12 text-center",
          isDragActive 
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]/50 scale-[0.99]' 
            : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--secondary))]/30',
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="h-16 w-16 bg-[hsl(var(--secondary))] rounded-full flex items-center justify-center mb-6">
          <Upload className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--foreground))]">
            {isDragActive ? "Drop the video here" : "Drag and drop video files here"}
        </h3>
        <p className="text-[hsl(var(--muted-foreground))] text-sm max-w-xs mb-8">
          Your files will be automatically enhanced with AI metadata and optimized for streaming.
        </p>
        
        <Button disabled={uploading}>
            {uploading ? "Uploading..." : "Select Files from Computer"}
        </Button>
        
        <div className="mt-8 flex items-center gap-6 text-xs text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--border))]" />
            MP4, MOV, WEBM
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--border))]" />
            Up to 2GB
          </div>
        </div>

        <AnimatePresence>
          {uploading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[hsl(var(--card))]/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-8 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                  <h4 className="text-xl font-bold text-[hsl(var(--foreground))]">Uploading Video</h4>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Please wait while we transfer your file...</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium text-[hsl(var(--foreground))]">
                    <span>{progress}% complete</span>
                  </div>
                  <Progress value={progress} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h4 className="font-semibold flex items-center gap-2 text-[hsl(var(--foreground))]">
            <Upload className="h-4 w-4" /> Smart Processing
          </h4>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            NovaAgent uses advanced AI to automatically caption, tag, and categorize your videos.
          </p>
        </Card>
        <Card className="p-6 space-y-4">
          <h4 className="font-semibold flex items-center gap-2 text-[hsl(var(--foreground))]">
            <Upload className="h-4 w-4" /> Secure Storage
          </h4>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Your videos are encrypted and stored securely in our private cloud vault.
          </p>
        </Card>
      </div>
    </div>
  )
}
