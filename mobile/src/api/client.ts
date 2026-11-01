import { File } from 'expo-file-system';

import { supabase } from '@/src/lib/supabase';
import type {
  CookedPage,
  FeedPage,
  HealthResponse,
  Profile,
  Recipe,
  RecipesResponse,
  SavedRecipe,
  ScanResponse,
} from '@/src/types';

const DEFAULT_TIMEOUT_MS = 10_000;
// Longer than the backend's 45 second Gemini timeout, so its friendly errors arrive first.
const AI_TIMEOUT_MS = 60_000;

export type ApiErrorKind = 'config' | 'timeout' | 'network' | 'http' | 'parse';

const MESSAGES: Record<ApiErrorKind, string> = {
  config: 'The app is missing its server address. Check EXPO_PUBLIC_API_URL.',
  timeout: 'The server took too long to respond. Please try again.',
  network: 'Could not reach the server. Check that it is running and you are on the same Wi-Fi.',
  http: 'Something went wrong on the server. Please try again.',
  parse: 'The server sent a response the app could not read.',
};

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status?: number,
    message?: string,
  ) {
    super(message ?? MESSAGES[kind]);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

// The backend sends user-friendly text in `detail`. Validation errors send a list, which is not.
async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === 'string' ? body.detail : undefined;
  } catch {
    return undefined;
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!baseUrl) throw new ApiError('config');

  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: controller.signal });
  } catch (error) {
    // The friendly message hides the cause, so keep it visible in the Expo terminal.
    console.warn(`Request to ${path} failed:`, error);
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await readDetail(response);
    // The session is no longer valid, so sending the user back to log in is the only way forward.
    if (response.status === 401 && token) await supabase.auth.signOut({ scope: 'local' });
    throw new ApiError('http', response.status, detail);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('parse', response.status);
  }
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export function scanPhotos(photoUris: string[]): Promise<ScanResponse> {
  const body = new FormData();
  // Expo's fetch rejects React Native's { uri, name, type } parts, so send real files.
  photoUris.forEach((uri) => body.append('images', new File(uri)));
  return request<ScanResponse>('/scan', { method: 'POST', body, timeoutMs: AI_TIMEOUT_MS });
}

export function findRecipes(
  scanId: string | null,
  ingredients: string[],
  useStaples: boolean,
): Promise<RecipesResponse> {
  return request<RecipesResponse>('/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scan_id: scanId, ingredients, use_staples: useStaples }),
    timeoutMs: AI_TIMEOUT_MS,
  });
}

export type SearchMode = 'name' | 'ingredient';

export function searchRecipes(
  query: string,
  mode: SearchMode,
  useAi = false,
): Promise<RecipesResponse> {
  const params = `q=${encodeURIComponent(query)}&mode=${mode}&ai=${useAi}`;
  return request<RecipesResponse>(`/search?${params}`, { timeoutMs: AI_TIMEOUT_MS });
}

export function getProfile(): Promise<Profile> {
  return request<Profile>('/profile');
}

export function updateProfile(
  displayName: string | null,
  avoidIngredients: string[],
): Promise<Profile> {
  return request<Profile>('/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName, avoid_ingredients: avoidIngredients }),
  });
}

type NewCooked = {
  recipe: Recipe;
  scanId: string | null;
  caption: string;
  isPublic: boolean;
  photoUri: string | null;
};

export function createCooked(cooked: NewCooked): Promise<{ id: string }> {
  const body = new FormData();
  body.append('recipe', JSON.stringify(cooked.recipe));
  body.append('caption', cooked.caption);
  body.append('is_public', String(cooked.isPublic));
  if (cooked.scanId) body.append('scan_id', cooked.scanId);
  if (cooked.photoUri) body.append('photo', new File(cooked.photoUri));
  return request<{ id: string }>('/cooked', { method: 'POST', body, timeoutMs: AI_TIMEOUT_MS });
}

export function getCookedPage(cursor: string | null): Promise<CookedPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request<CookedPage>(`/cooked${query}`);
}

export function getFeedPage(cursor: string | null): Promise<FeedPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request<FeedPage>(`/feed${query}`);
}

export function getOnlineRecipe(externalId: string): Promise<SavedRecipe> {
  return request<SavedRecipe>(`/online-recipes/${encodeURIComponent(externalId)}`);
}
