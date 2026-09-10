import type {
  DoctorDashboardBoard,
  DoctorDashboardLayout,
  DoctorDashboardWidget,
  DoctorDashboardWorkspace,
} from '../types/doctorDashboard';
import {
  djangoGetDoctorDashboard,
  djangoSaveDoctorDashboard,
  isDjangoApiEnabled,
} from './djangoApiService';

export type Unsubscribe = () => void;

function slugBoardId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'board';
}

export function getActiveBoard(
  workspace: DoctorDashboardWorkspace | null,
): DoctorDashboardBoard | null {
  if (!workspace?.boards.length) return null;
  const active =
    workspace.boards.find((board) => board.id === workspace.activeBoardId) ??
    workspace.boards[0];
  return active ?? null;
}

const listeners = new Map<string, Set<(workspace: DoctorDashboardWorkspace) => void>>();

function notifyListeners(doctorId: string, workspace: DoctorDashboardWorkspace): void {
  listeners.get(doctorId)?.forEach((listener) => {
    listener(workspace);
  });
}

function normalizeWidget(raw: unknown): DoctorDashboardWidget | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.id !== 'string' || typeof entry.type !== 'string') return null;
  return {
    id: entry.id,
    type: entry.type as DoctorDashboardWidget['type'],
    title: typeof entry.title === 'string' ? entry.title : undefined,
    subtitle: typeof entry.subtitle === 'string' ? entry.subtitle : undefined,
    span: entry.span as DoctorDashboardWidget['span'],
    order: typeof entry.order === 'number' ? entry.order : undefined,
    accent: entry.accent as DoctorDashboardWidget['accent'],
    dataBinding:
      typeof entry.dataBinding === 'string' ? entry.dataBinding : undefined,
    config:
      entry.config && typeof entry.config === 'object'
        ? (entry.config as Record<string, unknown>)
        : undefined,
  };
}

function normalizeBoard(raw: unknown, fallbackId: string): DoctorDashboardBoard | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  const widgets = Array.isArray(entry.widgets)
    ? entry.widgets
        .map(normalizeWidget)
        .filter((widget): widget is DoctorDashboardWidget => widget !== null)
    : [];
  return {
    id: typeof entry.id === 'string' ? entry.id : fallbackId,
    title: typeof entry.title === 'string' ? entry.title : 'Dashboard',
    subtitle: typeof entry.subtitle === 'string' ? entry.subtitle : undefined,
    theme: (entry.theme as DoctorDashboardBoard['theme']) ?? 'light',
    widgets,
    createdBy: entry.createdBy === 'doctor' ? 'doctor' : 'ayah',
  };
}

function normalizeWorkspace(raw: {
  activeBoardId?: string | null;
  boards?: unknown[];
}): DoctorDashboardWorkspace {
  const boards = (raw.boards ?? [])
    .map((board, index) => normalizeBoard(board, `board-${index}`))
    .filter((board): board is DoctorDashboardBoard => board !== null);
  return {
    activeBoardId:
      typeof raw.activeBoardId === 'string'
        ? raw.activeBoardId
        : boards[0]?.id ?? null,
    boards,
  };
}

async function loadWorkspaceFromBackend(): Promise<DoctorDashboardWorkspace> {
  const data = await djangoGetDoctorDashboard();
  return normalizeWorkspace(data);
}

async function persistWorkspaceToBackend(
  workspace: DoctorDashboardWorkspace,
): Promise<DoctorDashboardWorkspace> {
  const payload = {
    activeBoardId: workspace.activeBoardId,
    boards: workspace.boards.map((board) => ({
      id: board.id,
      title: board.title,
      subtitle: board.subtitle,
      theme: board.theme ?? 'light',
      widgets: board.widgets,
      createdBy: board.createdBy ?? 'ayah',
    })),
  };
  const saved = await djangoSaveDoctorDashboard(payload);
  return normalizeWorkspace(saved);
}

export async function fetchDoctorDashboardWorkspace(
  doctorId: string,
): Promise<DoctorDashboardWorkspace> {
  if (!isDjangoApiEnabled()) {
    const empty = { activeBoardId: null, boards: [] };
    notifyListeners(doctorId, empty);
    return empty;
  }

  const workspace = await loadWorkspaceFromBackend();
  notifyListeners(doctorId, workspace);
  return workspace;
}

export function listenToDoctorDashboardWorkspace(
  doctorId: string,
  onUpdate: (workspace: DoctorDashboardWorkspace) => void,
): Unsubscribe {
  if (!listeners.has(doctorId)) {
    listeners.set(doctorId, new Set());
  }
  listeners.get(doctorId)!.add(onUpdate);

  void fetchDoctorDashboardWorkspace(doctorId).catch((err) => {
    console.error('[doctorDashboardService] load failed', err);
    onUpdate({ activeBoardId: null, boards: [] });
  });

  return () => {
    listeners.get(doctorId)?.delete(onUpdate);
  };
}

export function listenToDoctorDashboard(
  doctorId: string,
  onUpdate: (layout: DoctorDashboardLayout | null) => void,
): Unsubscribe {
  return listenToDoctorDashboardWorkspace(doctorId, (workspace) => {
    onUpdate(getActiveBoard(workspace));
  });
}

async function commitWorkspace(
  doctorId: string,
  workspace: DoctorDashboardWorkspace,
): Promise<DoctorDashboardWorkspace> {
  const next = isDjangoApiEnabled()
    ? await persistWorkspaceToBackend(workspace)
    : workspace;
  notifyListeners(doctorId, next);
  return next;
}

export async function saveDoctorDashboardBoard(
  doctorId: string,
  board: Pick<DoctorDashboardBoard, 'id' | 'title' | 'subtitle' | 'widgets' | 'theme'>,
  options?: { replaceAll?: boolean },
): Promise<DoctorDashboardWorkspace> {
  const existing = await fetchDoctorDashboardWorkspace(doctorId).catch(() => ({
    activeBoardId: null,
    boards: [] as DoctorDashboardBoard[],
  }));

  const activeWorkspace = options?.replaceAll
    ? { activeBoardId: null, boards: [] as DoctorDashboardBoard[] }
    : existing;

  const nextBoard: DoctorDashboardBoard = {
    id: board.id || slugBoardId(board.title),
    title: board.title,
    subtitle: board.subtitle,
    theme: board.theme ?? 'light',
    widgets: board.widgets,
    createdBy: 'ayah',
  };

  if (options?.replaceAll || nextBoard.widgets.length === 0) {
    return commitWorkspace(doctorId, { activeBoardId: null, boards: [] });
  }

  const existingIndex = activeWorkspace.boards.findIndex(
    (entry) => entry.id === nextBoard.id,
  );
  const boards =
    existingIndex >= 0
      ? activeWorkspace.boards.map((entry, index) =>
          index === existingIndex ? nextBoard : entry,
        )
      : [...activeWorkspace.boards, nextBoard];

  return commitWorkspace(doctorId, {
    activeBoardId: nextBoard.id,
    boards,
  });
}

export async function setActiveDashboardBoard(
  doctorId: string,
  boardId: string,
): Promise<void> {
  const workspace = await fetchDoctorDashboardWorkspace(doctorId);
  if (!workspace.boards.some((board) => board.id === boardId)) return;
  await commitWorkspace(doctorId, { ...workspace, activeBoardId: boardId });
}

export async function saveDoctorDashboardLayout(
  doctorId: string,
  layout: Pick<DoctorDashboardLayout, 'title' | 'subtitle' | 'widgets' | 'theme'>,
): Promise<void> {
  await saveDoctorDashboardBoard(doctorId, {
    id: slugBoardId(layout.title),
    title: layout.title,
    subtitle: layout.subtitle,
    widgets: layout.widgets,
    theme: layout.theme,
  });
}

export async function clearDoctorDashboard(doctorId: string): Promise<void> {
  await saveDoctorDashboardBoard(
    doctorId,
    {
      id: 'empty',
      title: 'My dashboard',
      subtitle: 'Tell Ayah what you want to see',
      widgets: [],
      theme: 'light',
    },
    { replaceAll: true },
  );
}

export { slugBoardId };
