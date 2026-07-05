// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Remplace ces valeurs par celles que tu trouveras dans ton tableau de bord Supabase
// (Project Settings > API)
const supabaseUrl = 'https://qpbpuadlowlxehzowqfs.supabase.co';
const supabaseAnonKey = 'sb_publishable_mlIAvYSjfX6ggcgt1StNEw_wIkUfh0X';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);