import { djangoListWellnessProviders } from './djangoApiService';
import type { WellnessCategory, WellnessProvider } from '../types';

export function wellnessCategoryLabel(category: WellnessCategory): string {
  switch (category) {
    case 'nutrition':
      return 'Nutrition';
    case 'fitness':
      return 'Fitness';
    case 'mental_health':
      return 'Mental health';
    case 'meal_plan':
      return 'Meal plans';
    case 'home_care':
      return 'Home care';
    default:
      return 'Wellness';
  }
}

function mapProvider(row: Record<string, unknown>): WellnessProvider {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Provider'),
    category: (row.category as WellnessCategory) ?? 'other',
    tagline: row.tagline as string | undefined,
    description: row.description as string | undefined,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    city: row.city as string | undefined,
    province: row.province as string | undefined,
    services: (row.services as string[]) ?? [],
    published: row.published === true,
    verified: row.verified === true,
    createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
  };
}

export async function listPublishedWellnessProviders(
  category?: WellnessCategory,
): Promise<WellnessProvider[]> {
  const rows = await djangoListWellnessProviders(category);
  return rows.map((row) => mapProvider(row as Record<string, unknown>));
}

export async function getWellnessProvider(id: string): Promise<WellnessProvider | null> {
  const rows = await djangoListWellnessProviders();
  const found = rows.find((row) => String((row as Record<string, unknown>).id) === id);
  return found ? mapProvider(found as Record<string, unknown>) : null;
}

export async function upsertWellnessProvider(
  _id: string | null,
  _input: Omit<WellnessProvider, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  throw new Error('Wellness provider updates are not yet available via Django API.');
}
