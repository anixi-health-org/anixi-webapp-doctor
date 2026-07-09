export type MoodValue = string | number | null | undefined;

const NUMERIC_LABELS: Record<number, string> = {
  0: 'Very low',
  1: 'Very sad',
  2: 'Sad',
  3: 'Neutral',
  4: 'Happy',
  5: 'Very happy',
};

export function getMoodScore(mood: MoodValue): number | null {
  if (mood === null || mood === undefined || mood === '') return null;
  if (typeof mood === 'number' && !Number.isNaN(mood)) return mood;
  const raw = String(mood).trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  const wordScores: Record<string, number> = {
    terrible: 1,
    awful: 1,
    bad: 2,
    sad: 2,
    anxious: 2,
    frustrated: 2,
    neutral: 3,
    okay: 3,
    calm: 3,
    good: 4,
    happy: 4,
    excellent: 5,
    'very happy': 5,
  };
  return wordScores[raw.toLowerCase()] ?? null;
}

export function normalizeMoodLabel(mood: MoodValue): string {
  const score = getMoodScore(mood);
  if (score !== null && NUMERIC_LABELS[score]) {
    return NUMERIC_LABELS[score];
  }
  if (typeof mood === 'string' && mood.trim()) {
    return mood.charAt(0).toUpperCase() + mood.slice(1);
  }
  return 'Not recorded';
}

export function getMoodEmoji(mood: MoodValue): string {
  const score = getMoodScore(mood);
  if (score === null) return '😐';
  if (score >= 5) return '😄';
  if (score >= 4) return '😊';
  if (score >= 3) return '😐';
  if (score >= 2) return '😔';
  return '😢';
}

export function getMoodCalendarStyles(score: number | null): {
  cell: string;
  dot: string;
} {
  if (score === null) {
    return {
      cell: 'border-gray-200 bg-white text-gray-700 hover:border-anixi-green/40 hover:bg-anixi-green/5',
      dot: '',
    };
  }
  if (score >= 4) {
    return {
      cell: 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100',
      dot: 'bg-green-500',
    };
  }
  if (score >= 3) {
    return {
      cell: 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
      dot: 'bg-amber-500',
    };
  }
  return {
    cell: 'border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100',
    dot: 'bg-rose-500',
  };
}

export function getMoodEntryStyles(mood: MoodValue): {
  bg: string;
  border: string;
  text: string;
} {
  const score = getMoodScore(mood);
  if (score === null) {
    return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' };
  }
  if (score >= 4) {
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' };
  }
  if (score >= 3) {
    return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' };
  }
  return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800' };
}

export function averageMoodScore(entries: Array<{ mood?: MoodValue }>): number | null {
  const scores = entries
    .map((e) => getMoodScore(e.mood))
    .filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}
