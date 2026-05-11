import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  'https://lrtsiikcocppthgvruav.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxydHNpaWtjb2NwcHRoZ3ZydWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Mzk3ODgsImV4cCI6MjA5MTExNTc4OH0.eq_vvkmNf7Iwf4ioKInPfds6Lsy6vTLAQsTcPexscy8',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
