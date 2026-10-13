import React from 'react';
import {
  History,
  Trash2,
  Volume2,
  PlusCircle,
  Copy,
  Check,
} from 'lucide-react';
import { TranslationResult } from '../types';
import { speechService } from '../utils/speech';

interface HistoryDrawerProps {
  history: TranslationResult[];
  onClearHistory: () => void;
  onAddToSentence: (word: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  history,
  onClearHistory,
  onAddToSentence,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div id="translation-history-panel" className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
            Translation Log ({history.length})
          </h3>
        </div>
        {history.length > 0 && (
          <button
            id="history-clear-btn"
            onClick={onClearHistory}
            className="text-[11px] text-neutral-400 hover:text-red-400 flex items-center space-x-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-neutral-800 pr-1">
        {history.length === 0 ? (
          <p className="text-xs text-neutral-500 italic text-center py-6">
            No translated signs recorded yet.
          </p>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.word}
                    className="w-9 h-9 rounded-lg object-cover bg-black shrink-0 border border-neutral-800"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
                    {item.word.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h4 className="text-xs font-bold text-white truncate">{item.word}</h4>
                    <span className="text-[10px] text-neutral-500">
                      {Math.round(item.confidence)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate max-w-[160px] sm:max-w-xs">
                    {item.meaning}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <button
                  onClick={() => onAddToSentence(item.word)}
                  title="Add to sentence"
                  className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => speechService.speak(item.word)}
                  title="Speak"
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCopy(item.id, item.word)}
                  title="Copy"
                  className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
