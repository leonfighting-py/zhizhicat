import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { PetSprite } from "./components/PetSprite";
import { frameIndexAt } from "./pet/animations";
import {
  animationForState,
  createPetState,
  reducePetState,
  type PetState,
} from "./pet/machine";
import type { RandomSource } from "./pet/random";
import {
  tauriNative,
  type NativeAdapter,
  type TrayAction,
} from "./runtime/native";
import {
  normalizeSettings,
  type PetSettings,
  type SizeScale,
} from "./settings/settings";

interface AppProps {
  native?: NativeAdapter;
  now?: () => number;
  random?: RandomSource;
}

interface PointerStart {
  id: number;
  x: number;
  y: number;
  dragging: boolean;
}

const MOVE_INTERVAL_MS = 50;
const BEHAVIOR_INTERVAL_MS = 80;
const WALK_SPEED_PX_PER_SECOND = 36;
const DRAG_THRESHOLD_PX = 8;

export function App({
  native = tauriNative,
  now = Date.now,
  random = Math.random,
}: AppProps) {
  const [settings, setSettings] = useState<PetSettings | null>(null);
  const [petState, setPetState] = useState<PetState | null>(null);
  const [renderNow, setRenderNow] = useState(() => now());
  const [fatalError, setFatalError] = useState<string | null>(null);

  const settingsRef = useRef<PetSettings | null>(null);
  const petStateRef = useRef<PetState | null>(null);
  const pointerRef = useRef<PointerStart | null>(null);

  const transition = useCallback(
    (event: Parameters<typeof reducePetState>[1]) => {
      setPetState((current) => {
        if (!current) return current;
        const next = reducePetState(current, event, random);
        petStateRef.current = next;
        return next;
      });
    },
    [random],
  );

  const persistSettings = useCallback(
    (patch: Partial<PetSettings>) => {
      const current = settingsRef.current;
      if (!current) return;
      const next = normalizeSettings({ ...current, ...patch });
      settingsRef.current = next;
      setSettings(next);
      void native.saveSettings(next).catch(() => undefined);
    },
    [native],
  );

  useEffect(() => {
    let cancelled = false;
    void native
      .loadSettings()
      .then((stored) => {
        if (cancelled) return;
        const normalized = normalizeSettings(stored);
        const initial = createPetState(
          now(),
          normalized.direction,
          normalized.paused,
          random,
        );
        settingsRef.current = normalized;
        petStateRef.current = initial;
        setSettings(normalized);
        setPetState(initial);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFatalError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [native, now, random]);

  useEffect(() => {
    if (!petState) return undefined;
    const timer = window.setInterval(() => {
      const timestamp = now();
      setRenderNow(timestamp);
      transition({ type: "tick", now: timestamp });
    }, BEHAVIOR_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [now, petState !== null, transition]);

  useEffect(() => {
    if (!petState) return undefined;
    let lastMovedAt = performance.now();
    let movePending = false;

    const timer = window.setInterval(() => {
      const timestamp = performance.now();
      const elapsedSeconds = Math.min((timestamp - lastMovedAt) / 1_000, 0.2);
      lastMovedAt = timestamp;
      const current = petStateRef.current;
      if (!current || current.mode !== "walking" || movePending) return;

      movePending = true;
      void native
        .moveStep(current.direction, elapsedSeconds * WALK_SPEED_PX_PER_SECOND)
        .then((result) => {
          if (!result.hitEdge) return;
          const eventNow = now();
          transition({ type: "edge", now: eventNow });
          const nextDirection = current.direction === "left" ? "right" : "left";
          persistSettings({
            direction: nextDirection,
            x: result.x,
            y: result.y,
            monitorName: result.monitorName,
          });
        })
        .catch(() => undefined)
        .finally(() => {
          movePending = false;
        });
    }, MOVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [native, now, persistSettings, petState !== null, transition]);

  const executeAction = useCallback(
    (action: TrayAction) => {
      const current = settingsRef.current;
      if (!current) return;
      const timestamp = now();

      if (action === "toggle-pause") {
        const paused = !current.paused;
        transition({ type: "setPaused", paused, now: timestamp });
        persistSettings({ paused });
        return;
      }

      const sizes: Partial<Record<TrayAction, SizeScale>> = {
        "size-small": 0.8,
        "size-normal": 1,
        "size-large": 1.25,
      };
      const sizeScale = sizes[action];
      if (sizeScale) {
        persistSettings({ sizeScale });
        void native.resizePet(sizeScale, current.paused).catch(() => undefined);
        return;
      }

      if (action === "toggle-autostart") {
        void native
          .setAutostart(!current.autostart)
          .then((autostart) => persistSettings({ autostart }))
          .catch(() => undefined);
      } else if (action === "reset") {
        void native.resetPosition().catch(() => undefined);
      } else if (action === "about") {
        void native.showAbout().catch(() => undefined);
      } else if (action === "quit") {
        void native.exitApp().catch(() => undefined);
      }
    },
    [native, now, persistSettings, transition],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void native.listenTray(executeAction).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, [executeAction, native]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId || pointer.dragging) return;
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    if (distance < DRAG_THRESHOLD_PX) return;

    pointer.dragging = true;
    transition({ type: "dragStart", now: now() });
    void native
      .startDragging()
      .then(() => native.finishDragging(settingsRef.current?.paused ?? false))
      .then((result) => {
        persistSettings({
          x: result.x,
          y: result.y,
          monitorName: result.monitorName,
        });
        transition({ type: "dragEnd", now: now() });
      })
      .catch(() => {
        transition({ type: "dragEnd", now: now() });
      })
      .finally(() => {
        pointerRef.current = null;
      });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.dragging) transition({ type: "click", now: now() });
    pointerRef.current = null;
  };

  if (fatalError) {
    return (
      <div className="fatal-error" role="alert">
        <strong>之之暂时无法启动</strong>
        <span>{fatalError}</span>
        <button onClick={() => void native.exitApp()}>退出</button>
      </div>
    );
  }

  if (!settings || !petState) return null;

  const animation = animationForState(petState);
  const frame = frameIndexAt(animation, renderNow - petState.actionStartedMs);

  return (
    <main className="pet-stage">
      <PetSprite
        action={petState.action}
        frame={frame}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void native.showContextMenu().catch(() => undefined);
        }}
        onPointerCancel={() => {
          pointerRef.current = null;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        sizeScale={settings.sizeScale}
      />
    </main>
  );
}
