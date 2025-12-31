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

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  views: string;
  uploadedAt: string;
  category: string;
  url: string;
}

export type AuthMode = 'signin' | 'signup';
export type AppView = 'dashboard' | 'upload' | 'search';
