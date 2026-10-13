export type GestureCategory =
  | 'asl_alphabet'
  | 'asl_word'
  | 'asl_number'
  | 'universal_gesture'
  | 'two_handed'
  | 'unknown';

export interface TranslationResult {
  id: string;
  timestamp: number;
  detected: boolean;
  word: string;
  category: GestureCategory;
  confidence: number;
  meaning: string;
  handDetails: string;
  alternatives?: string[];
  nextWordSuggestions?: string[];
  thumbnail?: string;
  isSequence?: boolean;
}

export interface PracticeTarget {
  id: string;
  name: string;
  category: 'alphabet' | 'words' | 'gestures' | 'numbers';
  symbol: string;
  description: string;
  tips: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface PracticeResult {
  isMatch: boolean;
  score: number;
  detectedAs: string;
  feedback: string;
  tips?: string[];
}

export interface DictionaryItem {
  id: string;
  name: string;
  category: 'alphabet' | 'words' | 'gestures' | 'numbers';
  icon: string;
  shortMeaning: string;
  instructions: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
}
