import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Hand,
  Camera,
  Target,
  Upload,
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  Info,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { TranslationResult, DictionaryItem } from './types';
import { CameraView } from './components/CameraView';
import { TranslationResultCard } from './components/TranslationResultCard';
import { SentenceBuilder } from './components/SentenceBuilder';
import { PracticeMode } from './components/PracticeMode';
import { PhotoUploadTranslator } from './components/PhotoUploadTranslator';
import { GestureDictionaryModal } from './components/GestureDictionaryModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { speechService } from './utils/speech';

export default function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'practice' | 'upload'>('live');
  const [currentResult, setCurrentResult] = useState<TranslationResult | null>(null);
  const [history, setHistory] = useState<TranslationResult[]>(() => {
    try {
      const saved = localStorage.getItem('gesture_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sentenceWords, setSentenceWords] = useState<string[]>([]);
  const [autoAppend, setAutoAppend] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [autoInterval, setAutoInterval] = useState(2);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDictOpen, setIsDictOpen] = useState(false);
  const [practiceTargetId, setPracticeTargetId] = useState<string>('word-hello');
  const [notification, setNotification] = useState<string | null>(null);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gesture_history', JSON.stringify(history.slice(0, 30)));
    } catch {
      // ignore
    }
  }, [history]);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Add word to sentence builder
  const handleAddToSentence = useCallback((word: string) => {
    if (!word) return;
    setSentenceWords((prev) => [...prev, word]);
    showToast(`Added "${word}" to sentence`);
  }, []);

  const handleRemoveWord = useCallback((index: number) => {
    setSentenceWords((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearSentence = useCallback(() => {
    setSentenceWords([]);
  }, []);

  // Handle translation from CameraView (single frame or multi-frame burst)
  const handleTranslate = useCallback(
    async (frameOrFrames: string | string[], isSequence: boolean) => {
      if (isTranslating) return;
      setIsTranslating(true);

      try {
        const payload = isSequence
          ? {
              frames: frameOrFrames as string[],
              contextHistory: sentenceWords.slice(-5),
            }
          : {
              image: frameOrFrames as string,
              contextHistory: sentenceWords.slice(-5),
            };

        const res = await fetch('/api/translate-gesture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Translation API error: ${res.statusText}`);
        }

        const data = await res.json();

        if (data.detected && data.word) {
          const thumbnail = Array.isArray(frameOrFrames) ? frameOrFrames[0] : frameOrFrames;
          const newResult: TranslationResult = {
            id: String(Date.now()),
            timestamp: Date.now(),
            detected: true,
            word: data.word,
            category: data.category || 'unknown',
            confidence: data.confidence || 90,
            meaning: data.meaning || '',
            handDetails: data.handDetails || '',
            alternatives: data.alternatives || [],
            nextWordSuggestions: data.nextWordSuggestions || [],
            thumbnail: thumbnail,
            isSequence,
          };

          setCurrentResult(newResult);
          setHistory((prev) => [newResult, ...prev.slice(0, 49)]);

          // Voice aloud if enabled
          if (autoSpeak) {
            speechService.speak(data.word);
          }

          // Automatically append to sentence if autoAppend is on and not duplicate
          if (autoAppend) {
            setSentenceWords((prev) => {
              const lastWord = prev[prev.length - 1];
              if (lastWord !== data.word) {
                return [...prev, data.word];
              }
              return prev;
            });
          }
        } else {
          // Hand not detected
          setCurrentResult({
            id: String(Date.now()),
            timestamp: Date.now(),
            detected: false,
            word: '',
            category: 'unknown',
            confidence: 0,
            meaning: 'No intentional hand sign detected. Ensure your hand is clearly visible inside the reticle.',
            handDetails: data.handDetails || 'No clear hand posture recognized.',
          });
        }
      } catch (err: any) {
        console.error('Translation failed:', err);
        showToast('Translation error: Check network or camera framing.');
      } finally {
        setIsTranslating(false);
      }
    },
    [isTranslating, sentenceWords, autoSpeak, autoAppend]
  );

  // For Practice Mode: capture a frame from the live video
  const captureLiveFrameForPractice = useCallback((): string | null => {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  const handleSelectAlternative = (altWord: string) => {
    if (!currentResult) return;
    setCurrentResult({
      ...currentResult,
      word: altWord,
    });
    if (autoSpeak) {
      speechService.speak(altWord);
    }
  };

  return (
    <div id="app-root" className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {notification && (
        <div
          id="toast-notification"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-neutral-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-full shadow-2xl flex items-center space-x-2 animate-fade-in"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Navigation Header */}
      <header id="main-header" className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60">
              <Hand className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  Hand Sign Translator
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  ASL & Gestures
                </span>
              </div>
              <p className="text-xs text-neutral-400 hidden sm:block">
                Translate hand gestures & signs into spoken words in real time
              </p>
            </div>
          </div>

          {/* Center Tabs: Live / Practice / Upload */}
          <div className="flex items-center space-x-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl text-xs">
            <button
              id="nav-tab-live"
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'live'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Camera</span>
            </button>

            <button
              id="nav-tab-practice"
              onClick={() => setActiveTab('practice')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'practice'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Practice Mode</span>
            </button>

            <button
              id="nav-tab-upload"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all ${
                activeTab === 'upload'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Photo Upload</span>
            </button>
          </div>

          {/* Right utility buttons: Dictionary & Speech Toggle */}
          <div className="flex items-center space-x-2">
            <button
              id="open-dictionary-btn"
              onClick={() => setIsDictOpen(true)}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 rounded-xl border border-neutral-800 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Sign Dictionary</span>
            </button>

            <button
              id="toggle-autospeak-btn"
              onClick={() => {
                setAutoSpeak(!autoSpeak);
                showToast(autoSpeak ? 'Audio speech muted' : 'Audio speech enabled');
              }}
              title={autoSpeak ? 'Mute auto-speech' : 'Enable auto-speech'}
              className={`p-2 rounded-xl border transition-colors ${
                autoSpeak
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
              }`}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Banner with tips */}
        <div className="mb-4 bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-3 flex items-center justify-between text-xs text-neutral-300">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Supports <strong className="text-white">ASL Alphabet</strong> (A-Z), <strong className="text-white">Numbers</strong> (0-9), <strong className="text-white">Common Phrases</strong> (Hello, Thank you, Please, Yes, No, I Love You, Water), and <strong className="text-white">Universal Gestures</strong> (Thumbs Up, Peace, OK, Rock On, Wave).
            </span>
          </div>
          <button
            onClick={() => setIsDictOpen(true)}
            className="text-emerald-400 hover:underline shrink-0 hidden sm:inline ml-4"
          >
            View reference →
          </button>
        </div>

        {/* 2-Column Responsive Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Camera Feed or Practice or Upload */}
          <div className="lg:col-span-7 space-y-4">
            {activeTab === 'live' && (
              <CameraView
                onTranslate={handleTranslate}
                isTranslating={isTranslating}
                autoTranslate={autoTranslate}
                setAutoTranslate={setAutoTranslate}
                autoInterval={autoInterval}
                setAutoInterval={setAutoInterval}
              />
            )}

            {activeTab === 'practice' && (
              <div className="space-y-4">
                {/* Embedded Camera feed for reference while practicing */}
                <CameraView
                  onTranslate={handleTranslate}
                  isTranslating={isTranslating}
                  autoTranslate={false}
                  setAutoTranslate={() => {}}
                  autoInterval={2}
                  setAutoInterval={() => {}}
                  handInFrameGuidance="Match your hand to the target sign below"
                />

                <PracticeMode
                  onCaptureFrame={captureLiveFrameForPractice}
                  initialTargetId={practiceTargetId}
                  onOpenDictionary={() => setIsDictOpen(true)}
                />
              </div>
            )}

            {activeTab === 'upload' && (
              <PhotoUploadTranslator
                onTranslateImage={async (base64) => {
                  await handleTranslate(base64, false);
                }}
                isTranslating={isTranslating}
              />
            )}
          </div>

          {/* Right Column: Live Translation Result, Sentence Builder, and History */}
          <div className="lg:col-span-5 space-y-4">
            {/* Real-time Result Card */}
            <TranslationResultCard
              result={currentResult}
              onAddToSentence={handleAddToSentence}
              onSelectAlternative={handleSelectAlternative}
              isTranslating={isTranslating}
            />

            {/* Sentence Builder & Grammar Polish */}
            <SentenceBuilder
              words={sentenceWords}
              onRemoveWord={handleRemoveWord}
              onClear={handleClearSentence}
              autoAppend={autoAppend}
              setAutoAppend={setAutoAppend}
            />

            {/* Translation Log & History */}
            <HistoryDrawer
              history={history}
              onClearHistory={() => setHistory([])}
              onAddToSentence={handleAddToSentence}
            />
          </div>
        </div>
      </main>

      {/* Dictionary Modal */}
      <GestureDictionaryModal
        isOpen={isDictOpen}
        onClose={() => setIsDictOpen(false)}
        onSelectForPractice={(item: DictionaryItem) => {
          setPracticeTargetId(item.id);
          setActiveTab('practice');
        }}
      />
    </div>
  );
}
