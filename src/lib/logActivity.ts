import { supabase } from './supabase';

export interface ActivityAuthor {
  id?: number | null;
  name?: string | null;
  email?: string | null;
  account_id?: number | null;
}

export interface LogActivityParams {
  quote_id: number;
  action: string;
  message?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  author?: ActivityAuthor | null;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const hasAuthor = params.author?.name;
  if (!hasAuthor) {
    console.warn('[logActivity] author not available — using fallback "Sistema". action:', params.action, 'quote_id:', params.quote_id);
  }

  try {
    await supabase.from('quote_activities').insert({
      quote_id: params.quote_id,
      action: params.action,
      message: params.message ?? null,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      author_chatwoot_user_id: params.author?.id ?? null,
      author_name: params.author?.name ?? 'Sistema',
      author_email: params.author?.email ?? null,
      author_account_id: params.author?.account_id ?? null,
    });
  } catch (err) {
    console.error('[logActivity] failed to insert activity:', err);
  }
}
