import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { Slider } from '../../components/Slider/Slider';
import { Toggle } from '../../components/Toggle/Toggle';
import { VideoPanel } from '../../components/VideoPanel/VideoPanel';
import { listCameras, type CameraDevice } from '../../detection/camera';
import { CONFIDENCE_THRESHOLD } from '../../lib/settings/schema';
import { settingsStore, useSettings } from '../../lib/settings/store';
import { useCamera } from '../camera/useCamera';
import { useHandTracker } from '../camera/useHandTracker';
import styles from './CameraSection.module.css';

const GENERIC_LABEL = /^Camera \d+$/;

/** Camera device, test preview, mirror, landmarks and the detection threshold. */
export function CameraSection() {
  const settings = useSettings();
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [testing, setTesting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);
  const { state: camera, retry } = useCamera({
    deviceId: settings.cameraDeviceId,
    enabled: testing,
  });
  const stream = camera.status === 'ready' ? camera.stream : null;
  const tracker = useHandTracker(videoRef, stream, testing);

  // Device labels only appear after permission, so re-list whenever the camera state changes.
  useEffect(() => {
    let cancelled = false;
    listCameras()
      .then((list) => {
        if (!cancelled) setDevices(list);
      })
      .catch(() => {
        if (!cancelled) setDevices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [camera.status]);

  const labelsKnown = devices.some((device) => !GENERIC_LABEL.test(device.label));
  const options = [
    { value: '', label: 'Default camera' },
    ...devices.map((device) => ({ value: device.deviceId, label: device.label })),
  ];

  return (
    <>
      <Select
        label="Camera"
        options={options}
        value={settings.cameraDeviceId ?? ''}
        onChange={(event) => settingsStore.update({ cameraDeviceId: event.target.value || null })}
        helper={labelsKnown ? undefined : 'Allow the camera once to see device names.'}
      />
      <div>
        <Button onClick={() => setTesting((value) => !value)}>
          {testing ? 'Stop test' : 'Test camera'}
        </Button>
      </div>
      {testing ? (
        <div className={styles.preview}>
          <VideoPanel
            stream={stream}
            state={
              camera.status === 'error'
                ? 'error'
                : camera.status === 'ready' && tracker.status !== 'loading'
                  ? 'live'
                  : 'loading'
            }
            label="Camera test"
            mirror={settings.mirrorVideo}
            onVideoElement={attachVideo}
            overlay={{ frameRef: tracker.frameRef, show: settings.showLandmarks }}
            error={
              camera.status === 'error'
                ? {
                    title: 'Camera unavailable',
                    body: camera.error.message,
                    actions: <Button onClick={retry}>Try again</Button>,
                  }
                : undefined
            }
          />
        </div>
      ) : null}
      <Toggle
        label="Mirror video"
        checked={settings.mirrorVideo}
        onChange={(mirrorVideo) => settingsStore.update({ mirrorVideo })}
        helper="Flips your preview like a mirror. Tracking is unaffected."
      />
      <Toggle
        label="Show landmarks"
        checked={settings.showLandmarks}
        onChange={(showLandmarks) => settingsStore.update({ showLandmarks })}
        helper="Draws the tracked hand skeleton over your video."
      />
      <Slider
        label="Detection threshold"
        min={CONFIDENCE_THRESHOLD.min}
        max={CONFIDENCE_THRESHOLD.max}
        step={CONFIDENCE_THRESHOLD.step}
        value={settings.confidenceThreshold}
        onChange={(confidenceThreshold) => settingsStore.update({ confidenceThreshold })}
        format={(value) => value.toFixed(2)}
        helper="Higher needs a cleaner pose before a sign counts; lower registers faster but mis-reads more."
      />
    </>
  );
}
