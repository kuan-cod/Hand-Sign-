import React, { useState } from 'react';
import {
  X,
  Search,
  BookOpen,
  Filter,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { DictionaryItem } from '../types';
import { GESTURE_DICTIONARY } from '../data/gestureDictionary';

interface GestureDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectForPractice: (item: DictionaryItem) => void;
}

export const GestureDictionaryModal: React.FC<GestureDictionaryModalProps> = ({
  isOpen,
  onClose,
  onSelectForPractice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'alphabet' | 'words' | 'gestures' | 'numbers'>('all');

  if (!isOpen) return null;

  const filteredItems = GESTURE_DICTIONARY.filter((item) => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.shortMeaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div id="gesture-dictionary-backdrop" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        id="gesture-dictionary-modal"
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center space-x-2.5">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">Sign & Gesture Dictionary</h3>
              <p className="text-xs text-neutral-400">
                Explore hand shapes, sign language vocabulary, and practice guides
              </p>
            </div>
          </div>
          <button
            id="gesture-dict-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row gap-3 bg-neutral-900">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="gesture-dict-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sign by name, letter, or tag (e.g., peace, hello, A)..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            {(
              [
                { id: 'all', label: 'All Signs' },
                { id: 'alphabet', label: 'ASL Alphabet' },
                { id: 'words', label: 'ASL Words' },
                { id: 'gestures', label: 'Universal' },
                { id: 'numbers', label: 'Numbers' },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === cat.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dictionary Grid Cards */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 scrollbar-thin scrollbar-thumb-neutral-800">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              No signs matched "{searchTerm}". Try a different search term.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5 flex flex-col justify-between hover:border-neutral-700 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-100">{item.name}</h4>
                        <p className="text-xs text-neutral-400">{item.shortMeaning}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {item.difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {item.instructions}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[10px] text-neutral-500">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <button
                      id={`dict-practice-btn-${item.id}`}
                      onClick={() => {
                        onSelectForPractice(item);
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Practice</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
