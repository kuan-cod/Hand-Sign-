import React from 'react';
import {
  Volume2,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Info,
  Layers,
  ArrowRight,
  Hand,
  Copy,
  Check,
} from 'lucide-react';
import { TranslationResult, GestureCategory } from '../types';
import { speechService } from '../utils/speech';

interface TranslationResultCardProps {
  result: TranslationResult | null;
  onAddToSentence: (word: string) => void;
  onSelectAlternative: (altWord: string) => void;
  isTranslating: boolean;
}

const CATEGORY_LABELS: Record<GestureCategory, { label: string; color: string }> = {
  asl_alphabet: { label: 'ASL Alphabet', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  asl_word: { label: 'ASL Word / Sign', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  asl_number: { label: 'ASL Number', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  universal_gesture: { label: 'Universal Gesture', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  two_handed: { label: 'Two-Handed Sign', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  unknown: { label: 'Hand Sign', color: 'bg-neutral-800 text-neutral-300 border-neutral-700' },
};

export const TranslationResultCard: React.FC<TranslationResultCardProps> = ({
  result,
  onAddToSentence,
  onSelectAlternative,
  isTranslating,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleSpeak = (text: string) => {
    speechService.speak(text);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isTranslating && !result) {
    return (
      <div id="translation-result-loading" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[260px] text-center">
        <Sparkles className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <p className="text-sm font-semibold text-neutral-200">Analyzing Hand Gesture...</p>
        <p className="text-xs text-neutral-400 mt-1">Recognizing fingers, palm angle, and sign shape</p>
      </div>
    );
  }

  if (!result || !result.detected) {
    return (
      <div id="translation-result-empty" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[260px] text-center">
        <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 flex items-center justify-center text-neutral-400 mb-3">
          <Hand className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-200">Ready to Translate</h3>
        <p className="text-xs text-neutral-400 max-w-sm mt-1">
          Hold your hand inside the camera frame and click <span className="text-emerald-400 font-semibold">Translate Sign</span> (or press <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-[10px]">Space</kbd>) to detect ASL letters, signs, or gestures.
        </p>
      </div>
    );
  }

  const categoryMeta = CATEGORY_LABELS[result.category] || CATEGORY_LABELS.unknown;

  return (
    <div id="translation-result-card" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl space-y-4">
      {/* Top Header: Badge & Confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryMeta.color}`}>
            {categoryMeta.label}
          </span>
          {result.isSequence && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Motion Gesture
            </span>
          )}
        </div>

        {/* Confidence meter */}
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-neutral-400">Match:</span>
          <span className={`font-bold ${result.confidence >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {Math.round(result.confidence)}%
          </span>
        </div>
      </div>

      {/* Center Main Result Display */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Translated Word
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
            {result.word}
          </h2>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            {result.meaning}
          </p>
        </div>

        {/* Thumbnail preview if captured */}
        {result.thumbnail && (
          <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-neutral-800 bg-black">
            <img
              src={result.thumbnail}
              alt="Hand gesture thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Hand details / posture observation */}
      {result.handDetails && (
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3 text-xs text-neutral-300 flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-neutral-200">Hand Shape: </span>
            <span>{result.handDetails}</span>
          </div>
        </div>
      )}

      {/* Action Buttons: Add to Sentence & Speak */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-800/80">
        <button
          id="result-add-sentence-btn"
          onClick={() => onAddToSentence(result.word)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-2 transition-colors active:scale-95 shadow-md shadow-emerald-950"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add to Sentence</span>
        </button>

        <button
          id="result-speak-btn"
          onClick={() => handleSpeak(result.word)}
          title="Speak word aloud"
          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl border border-neutral-700 transition-colors"
        >
          <Volume2 className="w-4 h-4" />
        </button>

        <button
          id="result-copy-btn"
          onClick={() => handleCopy(result.word)}
          title="Copy word"
          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl border border-neutral-700 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Alternatives & Next Word suggestions */}
      {((result.alternatives && result.alternatives.length > 0) ||
        (result.nextWordSuggestions && result.nextWordSuggestions.length > 0)) && (
        <div className="space-y-2 pt-2 border-t border-neutral-800/60 text-xs">
          {result.alternatives && result.alternatives.length > 0 && (
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-[11px] text-neutral-400 flex items-center space-x-1">
                <Layers className="w-3 h-3" />
                <span>Or meant:</span>
              </span>
              {result.alternatives.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => onSelectAlternative(alt)}
                  className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[11px] border border-neutral-700 transition-colors"
                >
                  {alt}
                </button>
              ))}
            </div>
          )}

          {result.nextWordSuggestions && result.nextWordSuggestions.length > 0 && (
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="text-[11px] text-neutral-400 flex items-center space-x-1">
                <ArrowRight className="w-3 h-3" />
                <span>Next sign:</span>
              </span>
              {result.nextWordSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => onAddToSentence(suggestion)}
                  className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded text-[11px] border border-emerald-500/20 transition-colors"
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
