import React, { useState } from 'react';
import {
  Target,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Camera,
  ChevronRight,
  BookOpen,
  Award,
  RefreshCw,
} from 'lucide-react';
import { DictionaryItem, PracticeResult } from '../types';
import { GESTURE_DICTIONARY } from '../data/gestureDictionary';

interface PracticeModeProps {
  onCaptureFrame: () => string | null;
  initialTargetId?: string;
  onOpenDictionary: () => void;
}

export const PracticeMode: React.FC<PracticeModeProps> = ({
  onCaptureFrame,
  initialTargetId,
  onOpenDictionary,
}) => {
  const [selectedItem, setSelectedItem] = useState<DictionaryItem>(() => {
    return (
      GESTURE_DICTIONARY.find((item) => item.id === initialTargetId) ||
      GESTURE_DICTIONARY[0]
    );
  });

  const [isChecking, setIsChecking] = useState(false);
  const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(null);

  const handleCheckSign = async () => {
    const frame = onCaptureFrame();
    if (!frame) {
      alert('Could not capture camera frame. Please ensure camera is active.');
      return;
    }

    setIsChecking(true);
    setPracticeResult(null);

    try {
      const res = await fetch('/api/practice-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: frame,
          targetSign: selectedItem.name,
          targetCategory: selectedItem.category,
        }),
      });

      if (!res.ok) throw new Error('Practice check failed');
      const data: PracticeResult = await res.json();
      setPracticeResult(data);
    } catch (err) {
      console.error('Error in practice check:', err);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div id="practice-mode-container" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-neutral-100">Sign Practice & Coaching</h3>
        </div>
        <button
          id="practice-open-dict-btn"
          onClick={onOpenDictionary}
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Browse All Signs</span>
        </button>
      </div>

      {/* Target Sign Picker / Carousel */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
          Choose Sign to Practice:
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-700">
          {GESTURE_DICTIONARY.slice(0, 14).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedItem(item);
                setPracticeResult(null);
              }}
              className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-all flex items-center space-x-2 ${
                selectedItem.id === item.id
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 shadow'
                  : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Target Details Card */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">{selectedItem.icon}</span>
            <div>
              <h4 className="text-sm font-bold text-white">{selectedItem.name}</h4>
              <p className="text-xs text-neutral-400">{selectedItem.shortMeaning}</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
            {selectedItem.difficulty}
          </span>
        </div>

        {/* Instructions */}
        <div className="pt-2 border-t border-neutral-800/80 text-xs text-neutral-300">
          <span className="font-semibold text-emerald-400">How to sign: </span>
          <span>{selectedItem.instructions}</span>
        </div>
      </div>

      {/* Action Check button */}
      <div className="flex items-center justify-between pt-1">
        <button
          id="practice-check-sign-btn"
          onClick={handleCheckSign}
          disabled={isChecking}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
        >
          {isChecking ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Analyzing Your Hand Sign...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Check My Hand Sign</span>
            </>
          )}
        </button>
      </div>

      {/* Practice Feedback Result Card */}
      {practiceResult && (
        <div
          id="practice-result-card"
          className={`rounded-xl p-4 border space-y-2.5 transition-all ${
            practiceResult.isMatch
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100'
              : 'bg-amber-500/10 border-amber-500/40 text-amber-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {practiceResult.isMatch ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-amber-400" />
              )}
              <span className="text-xs font-bold">
                {practiceResult.isMatch ? 'Great Job! Sign Matched!' : 'Needs Adjustment'}
              </span>
            </div>

            <div className="flex items-center space-x-1 text-xs font-extrabold">
              <Award className="w-3.5 h-3.5" />
              <span>{Math.round(practiceResult.score)}% Accuracy</span>
            </div>
          </div>

          <p className="text-xs text-neutral-200 leading-relaxed">
            {practiceResult.feedback}
          </p>

          {practiceResult.tips && practiceResult.tips.length > 0 && (
            <ul className="text-xs text-neutral-300 space-y-1 list-disc list-inside pt-1 border-t border-neutral-800/40">
              {practiceResult.tips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
