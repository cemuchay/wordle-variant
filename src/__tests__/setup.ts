import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createMockSupabase, type SupabaseMock } from './mocks/supabase';

const mockSupabase: SupabaseMock = createMockSupabase();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase.client,
}));

(globalThis as any).__mockSupabase = mockSupabase;

vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-0000-0000-000000000000');
