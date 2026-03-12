import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://cufyxqkbtkxvzzhrkmmn.supabase.co"
const supabasePublishableKey = "sb_publishable_JuOvnFpL3c_mWFT1lH5F_Q_w4ox-LU5"

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)