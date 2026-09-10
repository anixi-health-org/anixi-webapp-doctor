import { djangoCreateSupportRequest, djangoListSupportRequests } from './djangoApiService';

export interface SupportRequest {
  id: string;
  doctorId: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
  response?: string;
  respondedAt?: Date;
}

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date();
};

export const submitSupportRequest = async (
  doctorId: string,
  subject: string,
  message: string
): Promise<string> => {
  try {
    if (!subject || !subject.trim()) {
      throw new Error('Subject is required');
    }
    if (!message || !message.trim()) {
      throw new Error('Message is required');
    }
    if (message.trim().length < 10) {
      throw new Error('Message must be at least 10 characters');
    }

    if (djangoCreateSupportRequest) {
      const data = await djangoCreateSupportRequest({
        doctorId,
        subject: subject.trim(),
        message: message.trim(),
      });
      return String(data.id ?? 'support-request');
    }

    // Fallback until the Django support endpoint is wired: persist locally.
    const stored = JSON.parse(
      localStorage.getItem('anixi_support_requests') || '[]',
    ) as SupportRequest[];
    const id = `support-${Date.now()}`;
    const request: SupportRequest = {
      id,
      doctorId,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    localStorage.setItem(
      'anixi_support_requests',
      JSON.stringify([request, ...stored].slice(0, 100)),
    );
    return id;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to submit support request';
    throw new Error(errorMessage);
  }
};

export const getDoctorSupportRequests = async (
  doctorId: string,
  maxResults: number = 50
): Promise<SupportRequest[]> => {
  if (djangoListSupportRequests) {
    const rows = await djangoListSupportRequests(doctorId, maxResults);
    return rows.map((data: Record<string, unknown>) => ({
      id: String(data.id ?? ''),
      doctorId: String(data.doctorId ?? ''),
      subject: String(data.subject ?? ''),
      message: String(data.message ?? ''),
      status: (data.status as SupportRequest['status']) || 'open',
      priority: (data.priority as SupportRequest['priority']) || 'medium',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      response: data.response ? String(data.response) : undefined,
      respondedAt: data.respondedAt ? toDate(data.respondedAt) : undefined,
    }));
  }

  const stored = JSON.parse(
    localStorage.getItem('anixi_support_requests') || '[]',
  ) as SupportRequest[];
  return stored
    .filter((r) => r.doctorId === doctorId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, maxResults);
};
