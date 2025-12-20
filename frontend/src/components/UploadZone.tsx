import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/api'
import { getUploadUrl } from '../graphql/mutations'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'



interface UploadZoneProps {
    setNotification: (n: {message: string, type: 'success' | 'error'} | null) => void
}

export function UploadZone({ setNotification }: UploadZoneProps) {
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
        authMode: 'userPool',
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
      setTimeout(() => setNotification(null), 5000)
      
    } catch (error) {
      console.error('Error uploading file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during upload'
       setNotification({ message: `Upload failed: ${errorMessage}`, type: 'error' })
       setTimeout(() => setNotification(null), 5000)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [setNotification])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': []
    },
    maxFiles: 1
  })

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full max-w-2xl">
        {/* Header Section */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
            Upload introduction video
          </h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed font-medium">
             Upload a short video (up to 1080p) to introduce yourself or your project. Your video will be private until you publish it.
          </p>
        </div>

        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={cn(
            "relative group cursor-pointer border-2 border-dashed rounded-3xl p-16 transition-all duration-300 ease-in-out",
            isDragActive 
              ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]" 
              : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/30"
          )}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center justify-center gap-6">
            <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
                isDragActive ? "bg-indigo-600 shadow-lg shadow-indigo-100" : "bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100"
            )}>
              {uploading ? (
                 <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                 >
                    <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full" />
                 </motion.div>
              ) : (
                 <Upload className={cn("w-8 h-8", isDragActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
              )}
            </div>

            <div className="text-center">
                <p className="text-base font-semibold text-slate-900">
                    {isDragActive ? "Drop to upload" : "Drag and drop video files to upload"}
                </p>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                    Or <span className="text-indigo-600 font-bold decoration-2 underline-offset-4 hover:underline">select files</span> from your computer
                </p>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400 tracking-wider">
                <span className="px-2 py-1 bg-slate-100 rounded-md border border-slate-200">MAX 500MB</span>
                <span className="px-2 py-1 bg-slate-100 rounded-md border border-slate-200">MP4, MOV</span>
            </div>
          </div>

          {/* Elegant Progress Overlay */}
          <AnimatePresence>
            {uploading && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-[calc(1.5rem-2px)] flex flex-col items-center justify-center p-12"
                >
                    <div className="w-full max-w-xs space-y-4">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-900">Uploading video...</p>
                                <p className="text-xs font-semibold text-slate-500">{progress}% complete</p>
                            </div>
                            <button 
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                onClick={(e) => { e.stopPropagation(); /* Add abort logic if needed */ }}
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                            <motion.div 
                                className="h-full bg-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.3)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

