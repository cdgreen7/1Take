import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const buildUsername = (user: User) => {
  const emailPrefix = user.email?.split('@')[0]?.toLowerCase() ?? 'user';
  const sanitized = emailPrefix.replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'user';
  const suffix = user.id.replace(/-/g, '').slice(0, 6);

  return `${sanitized}_${suffix}`;
};

export const ensureProfile = async (user: User) => {
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, username, display_name, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const fallbackName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'New User';

  const profilePayload = {
    id: user.id,
    username: buildUsername(user),
    display_name: String(fallbackName).slice(0, 40),
  };

  const { data: insertedProfile, error: insertError } = await supabase
    .from('profiles')
    .insert(profilePayload)
    .select('id, username, display_name, created_at')
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedProfile;
};
