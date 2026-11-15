// Settings (docs/FRONTEND_DESIGN.md 6.10): label column left, controls right, auto-saved.
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button/Button';
import { KeyBindingInput } from '../components/KeyBindingInput/KeyBindingInput';
import { PageShell } from '../components/PageShell/PageShell';
import { Seal } from '../components/Seal/Seal';
import { SegmentedControl } from '../components/SegmentedControl/SegmentedControl';
import { Slider } from '../components/Slider/Slider';
import { TextField } from '../components/TextField/TextField';
import { useToast } from '../components/Toast/toastContext';
import { CONTENT } from '../content/content.config';
import { SIGN_IDS, type SignId } from '../engine/types';
import { useAuth, validateUsername } from '../features/auth/authContext';
import { describeAuthError } from '../features/auth/describeAuthError';
import { holdLabel } from '../features/jutsu/holdLabel';
import { CameraSection } from '../features/settings/CameraSection';
import { useSavedFlash } from '../features/settings/useSavedFlash';
import {
  DEFAULT_KEY_BINDINGS,
  INPUT_MODES,
  THEMES,
  type InputMode,
  type Theme,
} from '../lib/settings/schema';
import { settingsStore, useSettings } from '../lib/settings/store';
import styles from './SettingsPage.module.css';

const THEME_OPTIONS: readonly { value: Theme; label: string }[] = THEMES.map((value) => ({
  value,
  label: value === 'system' ? 'System' : value === 'dark' ? 'Dark' : 'Light',
}));

const INPUT_OPTIONS: readonly { value: InputMode; label: string }[] = INPUT_MODES.map((value) => ({
  value,
  label: value === 'webcam' ? 'Webcam' : 'Keyboard',
}));

const CHECK_DELAY_MS = 400;

interface SectionProps {
  id: string;
  title: string;
  description?: string;
  saved?: boolean;
  children: ReactNode;
}

export function SettingsSection({ id, title, description, saved = false, children }: SectionProps) {
  return (
    <section className={styles.section} aria-labelledby={`settings-${id}`}>
      <div className={styles.sectionHead}>
        <h2 id={`settings-${id}`} className={styles.sectionTitle}>
          {title}
        </h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        <p className={styles.saved} data-visible={saved || undefined} aria-live="polite">
          {saved ? 'Saved' : ''}
        </p>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function KeyBindingsSection() {
  const settings = useSettings();
  const [conflicts, setConflicts] = useState<Partial<Record<SignId, string>>>({});

  const update = (sign: SignId, code: string) => {
    const taken = (Object.entries(settings.keyBindings) as Array<[SignId, string]>).find(
      ([other, bound]) => other !== sign && bound === code,
    );
    if (taken) {
      setConflicts((current) => ({ ...current, [sign]: CONTENT.signs[taken[0]].name }));
      window.setTimeout(() => setConflicts((current) => ({ ...current, [sign]: undefined })), 3000);
      return;
    }
    setConflicts((current) => ({ ...current, [sign]: undefined }));
    settingsStore.update({ keyBindings: { ...settings.keyBindings, [sign]: code } });
  };

  return (
    <>
      <ul className={styles.bindings}>
        {SIGN_IDS.map((sign) => (
          <li key={sign} className={styles.bindingRow}>
            <Seal sign={sign} size={32} decorative />
            <span className={styles.bindingName}>{CONTENT.signs[sign].name}</span>
            <KeyBindingInput
              label={`Key for ${CONTENT.signs[sign].name}`}
              code={settings.keyBindings[sign]}
              onChange={(code) => update(sign, code)}
              conflictWith={conflicts[sign] ?? null}
            />
          </li>
        ))}
      </ul>
      <div>
        <Button
          variant="ghost"
          onClick={() => settingsStore.update({ keyBindings: DEFAULT_KEY_BINDINGS })}
        >
          Reset to defaults
        </Button>
      </div>
    </>
  );
}

function AccountSection() {
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const current = auth.user?.username ?? '';
  const [username, setUsername] = useState(current);
  const [checked, setChecked] = useState<{ username: string; available: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = username !== current;
  const usernameError = changed && username.length > 0 ? validateUsername(username) : null;
  const availability =
    !changed || username.length === 0 || usernameError
      ? 'idle'
      : checked?.username === username
        ? checked.available
          ? 'available'
          : 'taken'
        : 'checking';

  useEffect(() => {
    if (!changed || username.length === 0 || usernameError) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      auth
        .isUsernameAvailable(username)
        .then((available) => {
          if (!cancelled) setChecked({ username, available });
        })
        .catch(() => undefined);
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auth, username, changed, usernameError]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await auth.updateUsername(username);
      toast.show({ message: 'Username saved.', tone: 'ok' });
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setSaving(false);
    }
  };

  const logOut = async () => {
    await auth.signOut();
    await navigate('/', { replace: true });
  };

  return (
    <>
      <TextField
        label="Username"
        autoComplete="username"
        value={username}
        onChange={(event) => setUsername(event.target.value.toLowerCase())}
        helper="3 to 20 characters: lower-case letters, numbers and underscore."
        error={usernameError ?? (availability === 'taken' ? 'Taken' : (error ?? undefined))}
        ok={availability === 'available' ? 'Available' : undefined}
        disabled={saving || !auth.user}
      />
      <div>
        <Button
          variant="primary"
          onClick={() => void save()}
          loading={saving}
          disabled={!changed || Boolean(usernameError) || availability !== 'available'}
        >
          Save username
        </Button>
      </div>
      <TextField label="Email" value={auth.user?.email ?? 'Not available'} readOnly />
      <div>
        <Button onClick={() => void logOut()}>Log out</Button>
      </div>
    </>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const appearanceSaved = useSavedFlash([settings.theme]);
  const inputSaved = useSavedFlash([settings.inputMode]);
  const cameraSaved = useSavedFlash([
    settings.cameraDeviceId,
    settings.mirrorVideo,
    settings.showLandmarks,
    settings.confidenceThreshold,
  ]);
  const keysSaved = useSavedFlash([settings.keyBindings]);
  const audioSaved = useSavedFlash([settings.volume]);

  const setVolume = (key: keyof typeof settings.volume) => (value: number) =>
    settingsStore.update({ volume: { ...settings.volume, [key]: value } });

  return (
    <PageShell>
      <h1 className="t-display-md">Settings</h1>

      <SettingsSection
        id="appearance"
        title="Appearance"
        description="System follows your operating system and updates live."
        saved={appearanceSaved}
      >
        <SegmentedControl<Theme>
          label="Theme"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={(theme) => settingsStore.update({ theme })}
        />
      </SettingsSection>

      <SettingsSection
        id="input"
        title="Input"
        description="Webcam needs a recognition model; the keyboard works anywhere."
        saved={inputSaved}
      >
        <SegmentedControl<InputMode>
          label="Input mode"
          options={INPUT_OPTIONS}
          value={settings.inputMode}
          onChange={(inputMode) => settingsStore.update({ inputMode })}
        />
      </SettingsSection>

      <SettingsSection
        id="camera"
        title="Camera"
        description="Which camera to use and how your preview looks."
        saved={cameraSaved}
      >
        <CameraSection />
      </SettingsSection>

      <SettingsSection
        id="keys"
        title="Key bindings"
        description={`One key per sign. Hold it for ${holdLabel()} to register.`}
        saved={keysSaved}
      >
        <KeyBindingsSection />
      </SettingsSection>

      <SettingsSection
        id="audio"
        title="Audio"
        description="Sound arrives in a later version; your levels are saved now."
        saved={audioSaved}
      >
        <Slider
          label="Master"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume.master}
          onChange={setVolume('master')}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Effects"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume.sfx}
          onChange={setVolume('sfx')}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <Slider
          label="Music"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume.music}
          onChange={setVolume('music')}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </SettingsSection>

      <SettingsSection
        id="account"
        title="Account"
        description="Your name as opponents will see it."
      >
        <AccountSection />
      </SettingsSection>
    </PageShell>
  );
}
