import type { ReactNode } from 'react';
import { PageShell } from '../components/PageShell/PageShell';
import { SegmentedControl } from '../components/SegmentedControl/SegmentedControl';
import { THEMES, type Theme } from '../lib/settings/schema';
import { settingsStore, useSettings } from '../lib/settings/store';
import styles from './SettingsPage.module.css';

const THEME_OPTIONS: readonly { value: Theme; label: string }[] = THEMES.map((value) => ({
  value,
  label: value === 'system' ? 'System' : value === 'dark' ? 'Dark' : 'Light',
}));

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** Label column on the left, controls on the right (docs/FRONTEND_DESIGN.md 6.10). */
export function SettingsSection({ title, description, children }: SectionProps) {
  return (
    <section className={styles.section} aria-labelledby={`settings-${title}`}>
      <div className={styles.sectionHead}>
        <h2 id={`settings-${title}`} className={styles.sectionTitle}>
          {title}
        </h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const settings = useSettings();

  return (
    <PageShell>
      <h1 className="t-display-md">Settings</h1>

      <SettingsSection
        title="Appearance"
        description="System follows your operating system and updates live."
      >
        <SegmentedControl<Theme>
          label="Theme"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={(theme) => settingsStore.update({ theme })}
        />
      </SettingsSection>

      <SettingsSection
        title="More settings"
        description="Input mode, camera, detection threshold, key bindings, volume and your account."
      >
        <p className="t-secondary">These controls arrive in milestone v0.5.0.</p>
      </SettingsSection>
    </PageShell>
  );
}
