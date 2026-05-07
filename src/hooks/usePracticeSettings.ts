import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getBookableBlocks,
  getAllSoftBlocks,
  getBookingPolicy,
  listPracticeMembers,
} from '../services/practiceSettingsService';
import { BookableBlock, BookingPolicy, PracticeMember, SoftBlock } from '../types';

export interface PracticeSettingsState {
  bookableBlocks: BookableBlock[];
  softBlocks: SoftBlock[];
  bookingPolicy: BookingPolicy | null;
  members: PracticeMember[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export const usePracticeSettings = (): PracticeSettingsState => {
  const { practiceSession } = useAuth();
  const practiceId = practiceSession?.practice?.id ?? null;

  const [bookableBlocks, setBookableBlocks] = useState<BookableBlock[]>([]);
  const [softBlocks, setSoftBlocks] = useState<SoftBlock[]>([]);
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicy | null>(null);
  const [members, setMembers] = useState<PracticeMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!practiceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [blocks, soft, policy, mems] = await Promise.all([
        getBookableBlocks(practiceId),
        getAllSoftBlocks(practiceId),
        getBookingPolicy(practiceId),
        listPracticeMembers(practiceId),
      ]);
      setBookableBlocks(blocks);
      setSoftBlocks(soft);
      setBookingPolicy(policy);
      setMembers(mems);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load practice settings');
    } finally {
      setIsLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    load();
  }, [load]);

  return { bookableBlocks, softBlocks, bookingPolicy, members, isLoading, error, reload: load };
};
