import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BhajanData } from '@/data/content-loader';

export interface ActiveTrack {
  bhajanId: string;
  subdivisionId: string;
  title: string;
  singer?: string;
  audioUrl?: string;
  karaokeUrl?: string;
  pageUrl: string;
}

export interface AudioPlayerContextType {
  // Track information
  activeTrack: ActiveTrack | null;
  activeAudioMode: 'bhajan' | 'karaoke';
  currentAudioSource: string | null;

  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLooping: boolean;

  // Controller UI state
  isMinimized: boolean;
  hasUserMoved: boolean;

  // Download state
  downloadState: 'idle' | 'downloading' | 'completed' | 'error';
  downloadProgress: number;

  // Actions
  playTrack: (bhajan: BhajanData, mode?: 'bhajan' | 'karaoke', autoPlay?: boolean) => void;
  togglePlayPause: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  skip: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
  selectAudioMode: (mode: 'bhajan' | 'karaoke') => void;
  downloadAudio: () => Promise<void>;
  stopAndClose: () => void;
  toggleMinimize: () => void;
  setIsMinimized: (val: boolean) => void;
  setHasUserMoved: (val: boolean) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

const VOLUME_STORAGE_KEY = 'tatvaarth_bhajan_volume';

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTrack, setActiveTrack] = useState<ActiveTrack | null>(null);
  const [activeAudioMode, setActiveAudioMode] = useState<'bhajan' | 'karaoke'>('bhajan');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUserMoved, setHasUserMoved] = useState(false);

  // Download state
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'completed' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Volume persistent in localStorage across all bhajans
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    } catch {}
    return 0.8;
  });
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Singleton audio element initialized once
  if (!audioRef.current && typeof window !== 'undefined') {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;
  }

  // Determine active audio file URL
  const currentAudioSource = activeTrack
    ? activeAudioMode === 'karaoke'
      ? activeTrack.karaokeUrl || null
      : activeTrack.audioUrl || null
    : null;

  // Sync volume & mute to HTMLAudioElement
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  // Sync loop attribute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = isLooping;
  }, [isLooping]);

  // Setup audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      audio.volume = isMuted ? 0 : volume;
      audio.muted = isMuted;
      audio.loop = isLooping;
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (!audio.loop) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };
    const handleError = (e: Event) => {
      console.warn('Audio playback error:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [volume, isMuted, isLooping]);

  // Update MediaSession API for background lock screen controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !activeTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeTrack.title,
      artist: activeTrack.singer ? `Tatvaarth • ${activeTrack.singer}` : 'Tatvaarth Bhajan',
      album: 'जैन भजन संग्रह',
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play().catch(console.error);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (!audioRef.current) return;
      const skipTime = details.seekOffset || 10;
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - skipTime);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (!audioRef.current) return;
      const skipTime = details.seekOffset || 10;
      audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + skipTime);
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      stopAndClose();
    });
  }, [activeTrack]);

  // Play a specific bhajan
  const playTrack = useCallback((bhajan: BhajanData, mode?: 'bhajan' | 'karaoke', autoPlay: boolean = true) => {
    const chosenMode = mode || (bhajan.audioUrl ? 'bhajan' : bhajan.karaokeUrl ? 'karaoke' : 'bhajan');
    const sourceUrl = chosenMode === 'karaoke' ? bhajan.karaokeUrl : bhajan.audioUrl;
    if (!sourceUrl) return;

    const pageUrl = `/bhajan/${bhajan.subdivision}/${bhajan.slug || bhajan.id}`;

    setActiveTrack({
      bhajanId: bhajan.slug || bhajan.id,
      subdivisionId: bhajan.subdivision,
      title: bhajan.title,
      singer: bhajan.singer,
      audioUrl: bhajan.audioUrl,
      karaokeUrl: bhajan.karaokeUrl,
      pageUrl,
    });
    setActiveAudioMode(chosenMode);

    const audio = audioRef.current;
    if (audio) {
      if (audio.src !== sourceUrl) {
        audio.src = sourceUrl;
        audio.currentTime = 0;
      }
      audio.volume = isMuted ? 0 : volume;
      audio.muted = isMuted;
      audio.loop = isLooping;

      if (autoPlay) {
        audio.play().then(() => setIsPlaying(true)).catch(console.error);
      }
    }
  }, [volume, isMuted, isLooping]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [isPlaying]);

  const play = useCallback(() => {
    audioRef.current?.play().then(() => setIsPlaying(true)).catch(console.error);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const setVolume = useCallback((newVol: number) => {
    setVolumeState(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(newVol));
    } catch {}
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVol;
      audio.muted = false;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      const restored = volume === 0 ? 0.5 : volume;
      setIsMuted(false);
      setVolumeState(restored);
      audio.muted = false;
      audio.volume = restored;
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(restored));
      } catch {}
    } else {
      setIsMuted(true);
      audio.muted = true;
    }
  }, [isMuted, volume]);

  const toggleLoop = useCallback(() => {
    setIsLooping(prev => !prev);
  }, []);

  const selectAudioMode = useCallback((mode: 'bhajan' | 'karaoke') => {
    if (!activeTrack) return;
    const targetSource = mode === 'karaoke' ? activeTrack.karaokeUrl : activeTrack.audioUrl;
    if (!targetSource) return;

    setActiveAudioMode(mode);
    const audio = audioRef.current;
    if (audio) {
      audio.src = targetSource;
      audio.currentTime = 0;
      audio.volume = isMuted ? 0 : volume;
      audio.muted = isMuted;
      audio.loop = isLooping;
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [activeTrack, isMuted, volume, isLooping]);

  // Download active audio track with progress tracking
  const downloadAudio = useCallback(async () => {
    if (!currentAudioSource || downloadState === 'downloading') return;

    setDownloadState('downloading');
    setDownloadProgress(0);

    try {
      const response = await fetch(currentAudioSource);
      if (!response.ok) throw new Error('Download failed');

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      let blob: Blob;

      if (response.body && totalBytes > 0) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            receivedBytes += value.length;
            const pct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            setDownloadProgress(pct);
          }
        }

        blob = new Blob(chunks as unknown as BlobPart[]);
      } else {
        const interval = setInterval(() => {
          setDownloadProgress(prev => (prev < 90 ? prev + 15 : prev));
        }, 120);
        blob = await response.blob();
        clearInterval(interval);
      }

      setDownloadProgress(100);

      const cleanTitle = activeTrack?.title ? activeTrack.title.replace(/[\\/:*?"<>|]/g, '').trim() : 'bhajan';
      const modeSuffix = activeAudioMode === 'karaoke' ? '-Karaoke' : '';
      const ext = currentAudioSource.split('.').pop()?.split('?')[0] || 'mp3';
      const filename = `${cleanTitle}${modeSuffix}.${ext}`;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);

      setDownloadState('completed');
      setTimeout(() => {
        setDownloadState('idle');
        setDownloadProgress(0);
      }, 2500);
    } catch (err) {
      console.error('Audio download error:', err);
      try {
        const link = document.createElement('a');
        link.href = currentAudioSource;
        link.download = `${activeTrack?.title || 'bhajan'}.mp3`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {}
      setDownloadState('error');
      setTimeout(() => {
        setDownloadState('idle');
        setDownloadProgress(0);
      }, 2000);
    }
  }, [currentAudioSource, downloadState, activeTrack, activeAudioMode]);

  // Stop playback, clear audio element, release memory and unmount floating controller
  const stopAndClose = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setActiveTrack(null);
    setHasUserMoved(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => !prev);
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        activeTrack,
        activeAudioMode,
        currentAudioSource,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isLooping,
        isMinimized,
        hasUserMoved,
        downloadState,
        downloadProgress,
        playTrack,
        togglePlayPause,
        play,
        pause,
        seek,
        skip,
        setVolume,
        toggleMute,
        toggleLoop,
        selectAudioMode,
        downloadAudio,
        stopAndClose,
        toggleMinimize,
        setIsMinimized,
        setHasUserMoved,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};

