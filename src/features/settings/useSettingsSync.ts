import { useEffect } from 'react';
import { loadSettings, saveSettings } from '../../lib/api/settings';
import { parseSettings } from '../../lib/settings/schema';
import { settingsStore } from '../../lib/settings/store';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/authContext';

const SAVE_DEBOUNCE_MS = 500;

/**
 * Keeps settings in step with the user_settings row: on sign-in the stored blob wins over the
 * local cache (it is the last thing the player saved anywhere), then every change is written
 * through, debounced. Dev users and builds without Supabase keep local settings only.
 */
export function useSettingsSync(): void {
  const { user } = useAuth();

  useEffect(() => {
    const client = supabase;
    if (!client || !user || user.id === 'dev-user') return;
    const userId = user.id;
    let cancelled = false;
    let timer = 0;

    loadSettings(client, userId)
      .then((stored) => {
        if (cancelled) return;
        if (stored === null) {
          void saveSettings(client, userId, settingsStore.get()).catch(() => undefined);
        } else {
          settingsStore.replace(parseSettings(stored));
        }
      })
      .catch(() => undefined);

    const offPersist = settingsStore.onPersist((settings) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveSettings(client, userId, settings).catch(() => undefined);
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      offPersist();
    };
  }, [user]);
}
