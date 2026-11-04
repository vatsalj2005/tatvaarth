import React, { useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
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
  GripHorizontal,
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
    hasUserMoved,
    togglePlayPause,
    seek,
    skip,
    setVolume,
    toggleMute,
    toggleLoop,
    stopAndClose,
    toggleMinimize,
    setHasUserMoved,
  } = useAudioPlayer();

  const { language, t } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const constraintsRef = useRef<HTMLDivElement>(null);

  // If no track is active, don't render anything
  if (!activeTrack) return null;

  // Hide the floating controller if user is already on this bhajan's page
  const isCurrentBhajanPage =
    location.pathname === activeTrack.pageUrl ||
    location.pathname.endsWith(`/${activeTrack.bhajanId}`) ||
    (location.pathname.includes('/bhajan/') && location.pathname.includes(activeTrack.bhajanId));

  if (isCurrentBhajanPage) return null;

  // Check if current route is a Shastra/Granth page
  const isShastraPage =
    location.pathname.startsWith('/shastra') ||
    location.pathname.startsWith('/granth');

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

  // Automatic positioning classes if the user hasn't manually dragged it yet
  const defaultPositionClasses = !hasUserMoved
    ? isShastraPage
      ? 'bottom-6 right-4 sm:right-6'
      : 'bottom-6 left-1/2 -translate-x-1/2'
    : '';

  return (
    <div
      ref={constraintsRef}
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
    >
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        onDragStart={() => setHasUserMoved(true)}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`pointer-events-auto fixed select-none cursor-grab active:cursor-grabbing ${defaultPositionClasses}`}
      >
        <AnimatePresence mode="wait">
          {isMinimized ? (
            /* MINIMIZED PILL VIEW */
            <motion.div
              key="minimized"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-card/95 backdrop-blur-xl border border-gold/40 shadow-2xl shadow-gold/15 text-foreground hover:border-gold transition-colors"
            >
              {/* Disc / Music Note Icon with Audio Wave */}
              <button
                onClick={handleGoToBhajan}
                className="flex items-center gap-1.5 text-gold hover:text-gold-light transition-colors"
                title={language === 'hi' ? 'भजन पर जाएँ' : 'Take me to Bhajan'}
              >
                <div className="relative w-7 h-7 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
                  <Music className={`w-3.5 h-3.5 text-gold ${isPlaying ? 'animate-pulse' : ''}`} />
                  {isPlaying && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                </div>
              </button>

              {/* Title & Equalizer bars */}
              <div
                onClick={handleGoToBhajan}
                className="cursor-pointer flex items-center gap-2 max-w-[140px] sm:max-w-[200px]"
                title={activeTrack.title}
              >
                <span className="text-xs font-semibold truncate text-foreground/90">
                  {activeTrack.title}
                </span>

                {isPlaying && (
                  <div className="flex items-end gap-0.5 h-3 flex-shrink-0">
                    <span className="w-0.5 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-0.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>

              {/* Mini Play / Pause */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-gold text-primary-foreground flex items-center justify-center shadow-md shadow-gold/20 hover:scale-105 active:scale-95 transition-transform"
                title={isPlaying ? t('pauseAudio') : t('playBhajan')}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                )}
              </button>

              {/* Expand button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMinimize();
                }}
                className="p-1 rounded-full text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                title={language === 'hi' ? 'बड़ा करें' : 'Expand Controller'}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>

              {/* Stop & Remove */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopAndClose();
                }}
                className="p-1 rounded-full text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                title={language === 'hi' ? 'बंद करें और हटाएं' : 'Stop and Remove'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            /* EXPANDED FLOATING WIDGET */
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-[92vw] sm:w-[390px] p-3.5 sm:p-4 rounded-2xl bg-card/95 backdrop-blur-2xl border border-gold/40 shadow-2xl shadow-gold/20 flex flex-col gap-2.5 text-foreground"
            >
              {/* Drag Handle & Top Header Row */}
              <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                <div className="flex items-center gap-1.5 text-muted-foreground cursor-grab">
                  <GripHorizontal className="w-4 h-4 text-gold/60" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                  <span className="text-[11px] font-semibold text-gold uppercase tracking-wider">
                    {language === 'hi' ? 'भजन बैकग्राउंड में चालू' : 'Playing in Background'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Take me to Bhajan Button */}
                  <button
                    onClick={handleGoToBhajan}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-gold/15 text-gold hover:bg-gold hover:text-primary-foreground transition-all border border-gold/30"
                    title={language === 'hi' ? 'भजन पृष्ठ पर जाएँ' : 'Take me to Bhajan page'}
                  >
                    <span>{language === 'hi' ? 'भजन पर जाएँ' : 'Go to Bhajan'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>

                  {/* Minimize Button */}
                  <button
                    onClick={toggleMinimize}
                    className="p-1 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                    title={language === 'hi' ? 'छोटा करें' : 'Minimize Controller'}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {/* Stop & Remove Controller */}
                  <button
                    onClick={stopAndClose}
                    className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title={language === 'hi' ? 'बंद करें और हटाएं' : 'Stop & Close'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Singer */}
              <div className="flex items-center justify-between gap-2">
                <div
                  onClick={handleGoToBhajan}
                  className="cursor-pointer min-w-0 flex-1 hover:text-gold transition-colors"
                >
                  <h4 className="text-sm font-semibold truncate devanagari-safe">{activeTrack.title}</h4>
                  {activeTrack.singer && (
                    <p className="text-[11px] text-muted-foreground truncate">🎤 {activeTrack.singer}</p>
                  )}
                </div>

                {/* Equalizer animation */}
                {isPlaying && (
                  <div className="flex items-end gap-0.5 h-4 px-1.5">
                    <span className="w-0.5 h-3 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 h-4 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-0.5 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                    <span className="w-0.5 h-3.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '180ms' }} />
                  </div>
                )}
              </div>

              {/* Progress Scrubber + Time */}
              <div className="flex flex-col gap-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-gold hover:accent-gold-light focus:outline-none"
                />
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono px-0.5">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Bottom Controls Row: Volume (Left) | Rewind + Play + Forward (Center) | Repeat (Right) */}
              <div className="flex items-center justify-between pt-0.5 gap-2">
                {/* Volume Control */}
                <div className="flex items-center gap-1 min-w-[70px] sm:min-w-[90px]">
                  <button
                    onClick={toggleMute}
                    className="p-1 rounded-lg text-muted-foreground hover:text-gold transition-colors flex-shrink-0"
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
                    className="w-12 sm:w-16 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-gold hover:accent-gold-light focus:outline-none"
                  />
                </div>

                {/* Center Playback Controls */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <button
                    onClick={() => skip(-10)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                    title="Rewind 10s"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={togglePlayPause}
                    className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 via-gold to-yellow-300 text-primary-foreground flex items-center justify-center shadow-lg shadow-gold/25 hover:scale-105 active:scale-95 transition-transform"
                    title={isPlaying ? t('pauseAudio') : t('playBhajan')}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    )}
                  </button>

                  <button
                    onClick={() => skip(10)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                    title="Forward 10s"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Repeat / Loop Toggle */}
                <div className="flex items-center justify-end min-w-[70px] sm:min-w-[90px]">
                  <button
                    onClick={toggleLoop}
                    className={`p-1.5 rounded-lg border transition-all ${
                      isLooping
                        ? 'bg-gold/20 text-gold border-gold/50 shadow-sm shadow-gold/20'
                        : 'text-muted-foreground border-transparent hover:text-gold hover:bg-gold/10'
                    }`}
                    title={isLooping ? (language === 'hi' ? 'दोहराना चालू (Repeat On)' : 'Repeat On') : (language === 'hi' ? 'दोहराना बंद (Repeat Off)' : 'Repeat Off')}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

