import React, { useState } from 'react';
import {
  Volume2,
  Trash2,
  Copy,
  Check,
  Wand2,
  Delete,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { speechService } from '../utils/speech';

interface SentenceBuilderProps {
  words: string[];
  onRemoveWord: (index: number) => void;
  onClear: () => void;
  autoAppend: boolean;
  setAutoAppend: (val: boolean) => void;
}

export const SentenceBuilder: React.FC<SentenceBuilderProps> = ({
  words,
  onRemoveWord,
  onClear,
  autoAppend,
  setAutoAppend,
}) => {
  const [copied, setCopied] = useState(false);
  const [polishedSentence, setPolishedSentence] = useState<string | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);

  // Raw sentence text from joined words
  const rawSentence = words.join(' ');
  const activeSentence = polishedSentence || rawSentence;

  const handleSpeak = () => {
    if (activeSentence) {
      speechService.speak(activeSentence);
    }
  };

  const handleCopy = () => {
    if (activeSentence) {
      navigator.clipboard.writeText(activeSentence);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Call ASL grammar converter endpoint
  const handlePolishSentence = async () => {
    if (words.length === 0 || isPolishing) return;
    setIsPolishing(true);

    try {
      const res = await fetch('/api/asl-to-english', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      });

      if (!res.ok) throw new Error('Failed to convert sentence');
      const data = await res.json();
      if (data.fluentSentence) {
        setPolishedSentence(data.fluentSentence);
        // Automatically speak polished sentence
        speechService.speak(data.fluentSentence);
      }
    } catch (err) {
      console.error('ASL to English polish failed:', err);
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <div id="sentence-builder-panel" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col space-y-3 shadow-xl">
      {/* Top Header toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Sentence Builder & Speech
          </h3>
        </div>

        {/* Auto-append toggle */}
        <div className="flex items-center space-x-2 text-xs text-neutral-400">
          <span>Auto-Add Signs</span>
          <button
            id="sentence-auto-append-toggle"
            onClick={() => setAutoAppend(!autoAppend)}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              autoAppend ? 'bg-emerald-500' : 'bg-neutral-700'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                autoAppend ? 'left-4' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Sentence Output Box */}
      <div className="min-h-[72px] bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
        {words.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">
            Translated signs and letters will build up here into words and sentences...
          </p>
        ) : (
          <div className="space-y-2">
            {/* Word tokens with quick delete */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {words.map((word, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-lg text-xs font-medium border border-neutral-700 transition-colors"
                >
                  <span>{word}</span>
                  <button
                    onClick={() => {
                      onRemoveWord(idx);
                      setPolishedSentence(null);
                    }}
                    className="text-neutral-400 hover:text-red-400 ml-1"
                    title="Remove word"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {/* AI Polished Natural English Translation if generated */}
            {polishedSentence && (
              <div className="mt-2 pt-2 border-t border-neutral-800 flex items-start space-x-2 text-emerald-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="text-white">"{polishedSentence}"</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sentence Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center space-x-2">
          {/* Smart Polish ASL grammar to English */}
          <button
            id="sentence-smart-polish-btn"
            onClick={handlePolishSentence}
            disabled={words.length === 0 || isPolishing}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow flex items-center space-x-1.5 transition-all"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isPolishing ? 'animate-spin' : ''}`} />
            <span>{isPolishing ? 'Grammar Polishing...' : 'Polish Grammar'}</span>
          </button>

          {/* Speak sentence aloud */}
          <button
            id="sentence-speak-btn"
            onClick={handleSpeak}
            disabled={words.length === 0}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 flex items-center space-x-1.5 transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Speak Sentence</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Copy sentence */}
          <button
            id="sentence-copy-btn"
            onClick={handleCopy}
            disabled={words.length === 0}
            title="Copy sentence"
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-40 rounded-lg border border-neutral-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Backspace last word */}
          <button
            id="sentence-backspace-btn"
            onClick={() => {
              if (words.length > 0) {
                onRemoveWord(words.length - 1);
                setPolishedSentence(null);
              }
            }}
            disabled={words.length === 0}
            title="Delete last word"
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-40 rounded-lg border border-neutral-700 transition-colors"
          >
            <Delete className="w-3.5 h-3.5" />
          </button>

          {/* Clear all */}
          <button
            id="sentence-clear-all-btn"
            onClick={() => {
              onClear();
              setPolishedSentence(null);
            }}
            disabled={words.length === 0}
            title="Clear all"
            className="p-1.5 bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 disabled:opacity-40 rounded-lg border border-neutral-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
