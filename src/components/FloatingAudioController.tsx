import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioPlayer } from '@/contexts/AudioPlayerContext';
import { useApp } from '@/contexts/AppContext';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  Volume2,
  Volume1,
  VolumeX,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Music,
} from 'lucide-react';

export default function FloatingAudioController() {
  const {
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isLooping,
    isMinimized,
    togglePlayPause,
    seek,
    skip,
    setVolume,
    toggleMute,
    toggleLoop,
    stopAndClose,
    toggleMinimize,
  } = useAudioPlayer();

  const { language, t } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  // If no track is active, don't render anything
  if (!activeTrack) return null;

  // Check if user is on the exact, matching bhajan page for the active track
  const decodedPath = decodeURIComponent(location.pathname).replace(/\/+$/, '');
  const decodedTrackPage = decodeURIComponent(activeTrack.pageUrl).replace(/\/+$/, '');

  const pathParts = decodedPath.split('/').filter(Boolean);
  const isExactCurrentBhajan =
    decodedPath === decodedTrackPage ||
    (pathParts.length >= 3 &&
      pathParts[0] === 'bhajan' &&
      pathParts[1].toLowerCase() === activeTrack.subdivisionId.toLowerCase() &&
      (pathParts[2] === activeTrack.bhajanId ||
        pathParts[2] === activeTrack.title ||
        pathParts.slice(2).join('/') === activeTrack.bhajanId));

  // The console is removed ONLY when on the correct bhajan page
  if (isExactCurrentBhajan) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const handleGoToBhajan = () => {
    navigate(activeTrack.pageUrl);
  };

  return (
    <div
      className="fixed z-50 pointer-events-auto cursor-default select-none
        bottom-4 left-1/2 -translate-x-1/2
        sm:bottom-6 sm:right-6 sm:left-auto sm:translate-x-0"
    >
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* TRIMMED / MINIMIZED HORIZONTAL PILL VIEW */
          <motion.div
            key="minimized"
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-[94vw] sm:w-auto sm:min-w-[400px] sm:max-w-[480px] flex items-center justify-between gap-2.5 px-3.5 py-1.5 sm:py-2 rounded-full bg-card/95 backdrop-blur-xl border border-gold/40 shadow-2xl shadow-gold/15 text-foreground hover:border-gold transition-colors cursor-default"
          >
            {/* Left: Music badge + Title + Singer + Equalizer */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative w-6 h-6 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
                <Music className={`w-3 h-3 text-gold ${isPlaying ? 'animate-pulse' : ''}`} />
                {isPlaying && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>

              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="text-xs font-semibold truncate text-foreground/90">
                  {activeTrack.title}
                </span>
                {activeTrack.singer && (
                  <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                    • {activeTrack.singer}
                  </span>
                )}
              </div>

              {isPlaying && (
                <div className="flex items-end gap-0.5 h-2.5 flex-shrink-0">
                  <span className="w-0.5 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            {/* Right: Time badge + Play/Pause + Go to Bhajan + Expand + Close */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {/* Current time display */}
              <span className="font-mono text-[10px] text-gold/90 px-1.5 py-0.5 rounded bg-gold/10 hidden sm:inline">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Mini Play / Pause */}
              <button
                onClick={togglePlayPause}
                className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-gold text-primary-foreground flex items-center justify-center shadow-md shadow-gold/20 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                title={isPlaying ? t('pauseAudio') : t('playBhajan')}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                )}
              </button>

              {/* Go to Bhajan Icon Button */}
              <button
                onClick={handleGoToBhajan}
                className="p-1 rounded-full text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                title={language === 'hi' ? 'भजन पर जाएँ' : 'Take me to Bhajan'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* Expand button */}
              <button
                onClick={toggleMinimize}
                className="p-1 rounded-full text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                title={language === 'hi' ? 'बड़ा करें' : 'Expand Controller'}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>

              {/* Stop & Remove */}
              <button
                onClick={stopAndClose}
                className="p-1 rounded-full text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title={language === 'hi' ? 'बंद करें और हटाएं' : 'Stop and Remove'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* EXPANDED HORIZONTAL SPOTIFY-STYLE CONSOLE (REDUCED VERTICAL HEIGHT, INCREASED WIDTH) */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-[95vw] sm:w-[520px] md:w-[570px] p-2.5 sm:p-3 rounded-2xl bg-card/95 backdrop-blur-2xl border border-gold/40 shadow-2xl shadow-gold/20 flex flex-col gap-1.5 text-foreground cursor-default"
          >
            {/* Row 1: Track Info (Left) | Center Controls | Volume & Actions (Right) */}
            <div className="flex items-center justify-between gap-2">
              {/* Left: Track badge, Title & Singer */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="relative w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
                  <Music className={`w-3.5 h-3.5 text-gold ${isPlaying ? 'animate-pulse' : ''}`} />
                  {isPlaying && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  )}
                </div>

                <div className="min-w-0 flex-1 cursor-default">
                  <h4 className="text-xs sm:text-sm font-semibold truncate devanagari-safe leading-tight">{activeTrack.title}</h4>
                  {activeTrack.singer && (
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate leading-tight">🎤 {activeTrack.singer}</p>
                  )}
                </div>

                {isPlaying && (
                  <div className="hidden sm:flex items-end gap-0.5 h-3 px-0.5 flex-shrink-0">
                    <span className="w-0.5 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-0.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                )}
              </div>

              {/* Center: Playback Controls (Rewind 10s, Glowing Play/Pause, Forward 10s, Repeat) */}
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button
                  onClick={() => skip(-10)}
                  className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                  title="Rewind 10s"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-amber-600 via-gold to-yellow-300 text-primary-foreground flex items-center justify-center shadow-md shadow-gold/25 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  title={isPlaying ? t('pauseAudio') : t('playBhajan')}
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current translate-x-0.5" />
                  )}
                </button>

                <button
                  onClick={() => skip(10)}
                  className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                  title="Forward 10s"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={toggleLoop}
                  className={`p-1 sm:p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isLooping
                      ? 'bg-gold/20 text-gold border-gold/50 shadow-sm shadow-gold/20'
                      : 'text-muted-foreground border-transparent hover:text-gold hover:bg-gold/10'
                  }`}
                  title={isLooping ? (language === 'hi' ? 'दोहराना चालू (Repeat On)' : 'Repeat On') : (language === 'hi' ? 'दोहराना बंद (Repeat Off)' : 'Repeat Off')}
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Right: Volume & Actions (Go to Bhajan, Minimize, Close) */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                {/* Volume slider on sm+ screens */}
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={toggleMute}
                    className="p-1 rounded-lg text-muted-foreground hover:text-gold transition-colors flex-shrink-0 cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5 text-amber-500" />
                    ) : volume < 0.5 ? (
                      <Volume1 className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-14 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-gold hover:accent-gold-light focus:outline-none"
                  />
                </div>

                <div className="w-[1px] h-3.5 bg-border/40 hidden sm:block mx-0.5" />

                {/* Go to Bhajan */}
                <button
                  onClick={handleGoToBhajan}
                  className="p-1 sm:px-2 sm:py-0.5 rounded-lg text-[11px] font-medium bg-gold/15 text-gold hover:bg-gold hover:text-primary-foreground transition-all border border-gold/30 flex items-center gap-1 cursor-pointer"
                  title={language === 'hi' ? 'भजन पृष्ठ पर जाएँ' : 'Take me to Bhajan page'}
                >
                  <span className="hidden md:inline">{language === 'hi' ? 'भजन' : 'Bhajan'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                {/* Minimize Button */}
                <button
                  onClick={toggleMinimize}
                  className="p-1 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                  title={language === 'hi' ? 'छोटा करें' : 'Minimize Controller'}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Stop & Remove Controller */}
                <button
                  onClick={stopAndClose}
                  className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title={language === 'hi' ? 'बंद करें और हटाएं' : 'Stop & Close'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Row 2: Thin Inline Scrubber with Timestamps */}
            <div className="flex items-center gap-2 px-1 pt-0.5">
              <span className="text-[10px] text-muted-foreground font-mono w-7 text-right flex-shrink-0 cursor-default">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-gold hover:accent-gold-light focus:outline-none"
              />
              <span className="text-[10px] text-muted-foreground font-mono w-7 text-left flex-shrink-0 cursor-default">
                {formatTime(duration)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
