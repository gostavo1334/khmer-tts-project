import lettersData from '@/data/letters.json';

export interface Letter {
  id: string;
  type: 'consonant' | 'vowel';
  khmer: string;
  display: string;
  roman: string;
  tts: string;
}

export interface LetterWithAudio extends Letter {
  audioUrl: string;
}

// Type guard to check if data is a valid Letter
function isLetter(item: any): item is Letter {
  return item && 
         typeof item.id === 'string' &&
         (item.type === 'consonant' || item.type === 'vowel') &&
         typeof item.khmer === 'string' &&
         typeof item.display === 'string' &&
         typeof item.roman === 'string' &&
         typeof item.tts === 'string';
}

// All letters from the JSON file - cast and validate
const allLetters: Letter[] = lettersData.filter(isLetter) as Letter[];

// Separate consonants and vowels
export const consonants: Letter[] = allLetters.filter(l => l.type === 'consonant');
export const vowels: Letter[] = allLetters.filter(l => l.type === 'vowel');

// All letters for the keyboard
export const allLettersForKeyboard: Letter[] = allLetters;

// Get letter by ID
export function getLetterById(id: string): Letter | undefined {
  return allLetters.find(letter => letter.id === id);
}

// Get audio URL for a letter
export function getAudioUrl(id: string): string {
  return `/audio/${id}.wav`;
}

// Sample words for the word speaker
export const sampleWords = [
  { text: 'សួស្តី', label: 'Hello' },
  { text: 'អរគុណ', label: 'Thank you' },
  { text: 'កម្ពុជា', label: 'Cambodia' },
  { text: 'ភាសាខ្មែរ', label: 'Khmer language' },
  { text: 'សៀវភៅ', label: 'Book' }
];

// All letters with audio URLs
export function getLettersWithAudio(type?: 'consonant' | 'vowel'): LetterWithAudio[] {
  const filteredLetters = type 
    ? allLetters.filter(l => l.type === type)
    : allLetters;
  
  return filteredLetters.map(letter => ({
    ...letter,
    audioUrl: getAudioUrl(letter.id)
  }));
}

// Check if audio file exists (for fallback message)
export function shouldShowFallbackMessage(id: string): boolean {
  // In production, we can't easily check file existence from client
  // This is handled in the speech.ts file with error handling
  return false;
}

export { allLetters };
