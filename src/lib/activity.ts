import { supabase } from '@/integrations/supabase/client';

export async function logActivity(userName: string, actionType: string, serverIds?: string, details?: string) {
  await supabase.from('activity_log').insert({
    user_name: userName,
    action_type: actionType,
    server_ids: serverIds || null,
    details: details || null,
  });
}
