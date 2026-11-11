// Temporary home for the design-system preview until the router lands (feat/routing-shell),
// where it moves to the dev-only /dev/styleguide route.
import { useState } from 'react';
import {
  Banner,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  PageShell,
  Seal,
  SegmentedControl,
  Select,
  Skeleton,
  Slider,
  Spinner,
  TextField,
  PasswordField,
  Toggle,
  TopBar,
  useToast,
} from '../components';
import { CONTENT } from '../content/content.config';
import { ELEMENTS, SIGN_IDS } from '../engine/types';
import { THEMES, type Theme } from '../lib/settings/schema';
import { settingsStore, useSettings } from '../lib/settings/store';

const THEME_OPTIONS = THEMES.map((value) => ({
  value,
  label: value === 'system' ? 'System' : value === 'dark' ? 'Dark' : 'Light',
}));

export function App() {
  const settings = useSettings();
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [threshold, setThreshold] = useState(settings.confidenceThreshold);

  return (
    <>
      <TopBar
        end={
          <SegmentedControl<Theme>
            label="Theme"
            hideLabel
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={(theme) => settingsStore.update({ theme })}
          />
        }
      />
      <PageShell>
        <header>
          <h1 className="t-display-md">{CONTENT.game.title}</h1>
          <p className="t-lead t-secondary measure">{CONTENT.game.tagline}</p>
        </header>

        <section>
          <h2 className="t-heading">Elements</h2>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            {[...ELEMENTS, 'substitution' as const].map((element) => (
              <Seal key={element} element={element} size={48} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="t-heading">Signs</h2>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              marginTop: 'var(--space-4)',
            }}
          >
            {SIGN_IDS.map((sign, index) => (
              <Seal
                key={sign}
                sign={sign}
                size={48}
                tint={index < 3 ? 'fire' : undefined}
                variant={index === 0 ? 'stamped' : 'outline'}
              />
            ))}
            <Seal variant="empty" size={48} />
            <Seal element="substitution" variant="ring" progress={0.6} size={48} />
          </div>
        </section>

        <section style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="primary">Start battle</Button>
          <Button>Change difficulty</Button>
          <Button variant="ghost">Back to menu</Button>
          <Button variant="danger">Forfeit</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button variant="primary" size="lg" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button
            onClick={() => toast.show({ message: 'Saved to your match history', tone: 'ok' })}
          >
            Show toast
          </Button>
        </section>

        <section style={{ display: 'grid', gap: 'var(--space-6)', maxWidth: 400 }}>
          <TextField
            label="Email"
            type="email"
            placeholder="you@example.com"
            helper="We never share it."
          />
          <TextField label="Username" value="sakura_fan" readOnly ok="Available" />
          <TextField label="Username" defaultValue="x" error="3 to 20 characters." />
          <PasswordField label="Password" autoComplete="new-password" />
          <Select
            label="Camera"
            options={[{ value: 'a', label: 'Logitech C920' }]}
            helper="Names appear after you allow the camera."
          />
          <Toggle
            label="Mirror video"
            checked={mirror}
            onChange={setMirror}
            helper="Flips your preview."
          />
          <Slider
            label="Detection threshold"
            min={0.5}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={setThreshold}
            format={(v) => v.toFixed(2)}
            meter={0.62}
          />
        </section>

        <section style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <Banner tone="warn" onDismiss={() => undefined}>
            Best at 1280 px or wider.
          </Banner>
          <Banner tone="danger" action={<Button>Try again</Button>}>
            Couldn't load your matches.
          </Banner>
          <EmptyState
            title="No matches yet."
            action={<Button variant="primary">Play vs Bot</Button>}
          >
            Your first duel starts here.
          </EmptyState>
          <ErrorState
            title="Camera access is blocked."
            action={
              <>
                <Button variant="primary">Reload</Button>
                <Button>Use keyboard instead</Button>
              </>
            }
          >
            Allow the camera for this site in your browser's address bar, then reload.
          </ErrorState>
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <Spinner label="Loading" />
            <Skeleton width={240} height={16} />
            <Skeleton width={48} height={48} round />
          </div>
        </section>
      </PageShell>

      <Dialog
        open={dialogOpen}
        title="Paused"
        onClose={() => setDialogOpen(false)}
        actions={
          <>
            <Button variant="danger" onClick={() => setDialogOpen(false)}>
              Forfeit
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Resume
            </Button>
          </>
        }
      >
        The bot waits while this is open.
      </Dialog>
    </>
  );
}
