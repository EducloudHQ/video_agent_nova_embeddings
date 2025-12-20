export interface VideoStatus {
  requestId: string
  status: string
  message?: string
  callbackId?: string
  videoUrl?: string
}

export interface VideoAsset {
  id: string
  url: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  thumbnail?: string
  title: string
}
