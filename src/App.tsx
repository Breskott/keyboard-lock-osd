import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import logoUrl from "./assets/logo.svg";
import "./App.css";

type LockKeyId = "caps" | "num" | "scroll";
type Language = "en" | "zh" | "pt";
type OsdPositionId =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight";

const OSD_POSITIONS: OsdPositionId[] = [
  "topLeft",
  "topCenter",
  "topRight",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
];

type Theme = {
  id: string;
  name: string;
  accent: string;
  isDark: boolean;
};

const BUILTIN_THEMES: Theme[] = [
  { id: "dell", name: "Dell Green", accent: "#6ee6a4", isDark: true },
  { id: "blue", name: "Midnight", accent: "#6ea8ff", isDark: true },
  { id: "orange", name: "Sunset", accent: "#ffa86e", isDark: true },
  { id: "purple", name: "Royal", accent: "#c66eff", isDark: true },
  { id: "rose", name: "Rose", accent: "#ff7eb6", isDark: true },
];

const CUSTOM_THEME_ID = "custom";

type LockChangePayload = {
  key: LockKeyId;
  name: string;
  abbreviation: string;
  icon: LockKeyId;
  enabled: boolean;
};

type StartupToastPayload = {
  title: string;
  message: string;
};

type OsdNotice =
  | {
      kind: "lock";
      payload: LockChangePayload;
    }
  | {
      kind: "toast";
      payload: StartupToastPayload;
    };

type OsdEnabledMap = Record<LockKeyId, boolean>;

declare global {
  interface Window {
    __KEYBOARD_LOCK_OSD_SHOW?: (notice: OsdNotice) => void;
  }
}

const fallbackStates: LockChangePayload[] = [
  {
    key: "caps",
    name: "Caps Lock",
    abbreviation: "CAP",
    icon: "caps",
    enabled: false,
  },
  {
    key: "num",
    name: "Num Lock",
    abbreviation: "NUM",
    icon: "num",
    enabled: false,
  },
  {
    key: "scroll",
    name: "Scroll Lock",
    abbreviation: "SCRL",
    icon: "scroll",
    enabled: false,
  },
];

const defaultOsdEnabled: OsdEnabledMap = {
  caps: true,
  num: true,
  scroll: true,
};

const osdEnabledStorageKey = "keyboard-lock-osd.enabledKeys";
const suppressFullscreenStorageKey = "keyboard-lock-osd.suppressFullscreen";
const themeStorageKey = "keyboard-lock-osd.theme";

const copy = {
  en: {
    title: "Keyboard Lock OSD",
    subtitle: "Lock key indicators",
    osd: "OSD",
    preview: "Preview",
    status: "Current state",
    show: "Show OSD",
    startup: "Startup",
    startAtLogin: "Start at login",
    position: "Position",
    positionTopLeft: "Top left",
    positionTopCenter: "Top center",
    positionTopRight: "Top right",
    positionBottomLeft: "Bottom left",
    positionBottomCenter: "Bottom center",
    positionBottomRight: "Bottom right",
    animation: "Animation",
    fade: "Fade",
    hideInFullscreen: "Hide OSD in fullscreen",
    theme: "Theme",
    themeCustom: "Custom",
    customColor: "Custom color",
  },
  zh: {
    title: "Keyboard Lock OSD",
    subtitle: "锁定键状态提示",
    osd: "屏幕浮层",
    preview: "预览",
    status: "当前状态",
    show: "显示浮层",
    startup: "开机启动",
    startAtLogin: "开机自启",
    position: "位置",
    positionTopLeft: "左上",
    positionTopCenter: "顶部居中",
    positionTopRight: "右上",
    positionBottomLeft: "左下",
    positionBottomCenter: "底部居中",
    positionBottomRight: "右下",
    animation: "动画",
    fade: "淡入淡出",
    hideInFullscreen: "全屏时不显示浮层",
    theme: "主题",
    themeCustom: "自定义",
    customColor: "自定义颜色",
  },
  pt: {
    title: "Indicador de Teclas de Bloqueio",
    subtitle: "Indicador na tela para Caps/Num/Scroll Lock",
    osd: "OSD",
    preview: "Visualizar",
    status: "Estado atual",
    show: "Mostrar OSD",
    startup: "Inicialização",
    startAtLogin: "Iniciar com o Windows",
    position: "Posição na tela",
    positionTopLeft: "Superior esquerdo",
    positionTopCenter: "Superior central",
    positionTopRight: "Superior direito",
    positionBottomLeft: "Inferior esquerdo",
    positionBottomCenter: "Inferior central",
    positionBottomRight: "Inferior direito",
    animation: "Animação",
    fade: "Esmaecer",
    hideInFullscreen: "Ocultar OSD em tela cheia",
    theme: "Tema",
    themeCustom: "Personalizado",
    customColor: "Cor personalizada",
  },
};

function App() {
  const view = new URLSearchParams(window.location.search).get("view");

  if (view === "osd") {
    return <OsdView />;
  }

  return <SettingsView />;
}

function applyThemeToRoot(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  // light/dark variants derive accent soft variants via color-mix in CSS
  root.setAttribute("data-theme", theme.isDark ? "dark" : "light");
  // also pre-compute soft variants for components that need them
  const soft = hexToRgba(theme.accent, 0.16);
  const soft2 = hexToRgba(theme.accent, 0.32);
  const bright = lightenHex(theme.accent, 0.3);
  root.style.setProperty("--accent-soft", soft);
  root.style.setProperty("--accent-soft-2", soft2);
  root.style.setProperty("--accent-bright", bright);
  root.style.setProperty("--accent-text", theme.accent);
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = Math.min(255, Math.round(parseInt(full.slice(0, 2), 16) + 255 * amount));
  const g = Math.min(255, Math.round(parseInt(full.slice(2, 4), 16) + 255 * amount));
  const b = Math.min(255, Math.round(parseInt(full.slice(4, 6), 16) + 255 * amount));
  return `#${[r, g, b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function OsdView() {
  const [notice, setNotice] = useState<OsdNotice | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const refreshTheme = () => {
      invoke<Theme>("current_theme")
        .then((t) => {
          if (t) {
            applyThemeToRoot(t);
          }
        })
        .catch(() => {});
    };

    applyThemeToRoot({
      id: "dell",
      name: "Dell Green",
      accent: "#6ee6a4",
      isDark: true,
    });
    refreshTheme();

    const unlistenTheme = listen<Theme>("theme-change", (event) => {
      applyThemeToRoot(event.payload);
    });

    // also refresh on each lock-key press so OSD stays in sync even if
    // a theme-change event was missed (e.g. window recreated)
    const unlistenLock = listen<LockChangePayload>("lock-key-change", () => {
      refreshTheme();
    });

    return () => {
      unlistenTheme.then((u) => u());
      unlistenLock.then((u) => u());
    };
  }, []);

  useEffect(() => {
    const showNotice = (nextNotice: OsdNotice, duration = 1_400) => {
      window.clearTimeout(hideTimer.current);
      setNotice(nextNotice);
      setVisible(true);

      hideTimer.current = window.setTimeout(() => {
        setVisible(false);
      }, duration);
    };

    window.__KEYBOARD_LOCK_OSD_SHOW = (nextNotice) =>
      showNotice(nextNotice, nextNotice.kind === "toast" ? 2_400 : 1_400);

    const setup = async () => {
      const unlistenLock = await listen<LockChangePayload>(
        "lock-key-change",
        (event) => {
          showNotice({ kind: "lock", payload: event.payload });
        },
      );
      const unlistenToast = await listen<StartupToastPayload>(
        "startup-tray-toast",
        (event) => {
          showNotice({ kind: "toast", payload: event.payload }, 2_400);
        },
      );

      void invoke("osd_ready").catch(() => {});

      return () => {
        unlistenLock();
        unlistenToast();
      };
    };

    const unlisten = setup();

    return () => {
      window.clearTimeout(hideTimer.current);
      delete window.__KEYBOARD_LOCK_OSD_SHOW;
      unlisten.then((cleanup) => cleanup());
    };
  }, []);

  const isLock = notice?.kind === "lock";
  const lockEnabled = isLock && notice.payload.enabled;

  return (
    <main className="osd-stage" aria-live="polite">
      <div
        className={`osd-pill ${notice?.kind === "toast" ? "toast" : ""} ${
          visible && notice ? "is-visible" : ""
        } ${isLock ? (lockEnabled ? "is-on" : "is-off") : ""}`}
      >
        {isLock && (
          <>
            <LockIcon icon={notice.payload.icon} enabled={notice.payload.enabled} />
            <div className="osd-copy">
              <span className="osd-key-name">{notice.payload.name}</span>
              <span className={lockEnabled ? "osd-state on" : "osd-state off"}>
                {lockEnabled ? "ON" : "OFF"}
              </span>
            </div>
          </>
        )}
        {notice?.kind === "toast" && (
          <div className="osd-toast-copy">
            <strong>{notice.payload.title}</strong>
            <span>{notice.payload.message}</span>
          </div>
        )}
      </div>
    </main>
  );
}

function SettingsView() {
  const [language, setLanguage] = useState<Language>(() => detectBrowserLanguage());
  const [states, setStates] = useState<LockChangePayload[]>(fallbackStates);
  const [autostartEnabled, setAutostartEnabled] = useState<boolean | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [suppressFullscreenOsd, setSuppressFullscreenOsd] = useState<boolean>(() =>
    readStoredBoolean(suppressFullscreenStorageKey, true),
  );
  const [osdEnabled, setOsdEnabled] = useState<OsdEnabledMap>(() =>
    readStoredOsdEnabled(),
  );
  const [osdPosition, setOsdPosition] = useState<OsdPositionId>("bottomCenter");
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const text = copy[language];

  useEffect(() => {
    invoke<LockChangePayload[]>("current_lock_states")
      .then(setStates)
      .catch(() => setStates(fallbackStates));
  }, []);

  useEffect(() => {
    const unlisten = listen<LockChangePayload>("lock-state-change", (event) => {
      setStates((current) =>
        current.map((state) =>
          state.key === event.payload.key ? event.payload : state,
        ),
      );
    });

    return () => {
      unlisten.then((cleanup) => cleanup());
    };
  }, []);

  useEffect(() => {
    invoke<boolean>("current_autostart_enabled")
      .then(setAutostartEnabled)
      .catch(() => setAutostartEnabled(true));
  }, []);

  useEffect(() => {
    invoke<string>("current_language")
      .then((value) => {
        if (isLanguage(value)) {
          setLanguage(value);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    invoke<string>("current_version")
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    invoke<string>("current_osd_position")
      .then((value) => {
        if (isOsdPosition(value)) {
          setOsdPosition(value);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    invoke<Theme>("current_theme")
      .then((t) => {
        if (t) {
          setTheme(t);
          applyThemeToRoot(t);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    persistOsdEnabled(osdEnabled);
    Object.entries(osdEnabled).forEach(([key, enabled]) => {
      void invoke("set_osd_enabled", { key, enabled });
    });
  }, [osdEnabled]);

  useEffect(() => {
    persistBoolean(suppressFullscreenStorageKey, suppressFullscreenOsd);
    void invoke("set_suppress_fullscreen_osd", {
      enabled: suppressFullscreenOsd,
    });
  }, [suppressFullscreenOsd]);

  useEffect(() => {
    void invoke("set_osd_position", { position: osdPosition });
  }, [osdPosition]);

  useEffect(() => {
    applyThemeToRoot(theme);
    persistTheme(theme);
    void invoke("set_theme", { theme });
    // broadcast to OSD windows
    void emit("theme-change", theme);
  }, [theme]);

  const enabledCount = useMemo(
    () => states.filter((state) => state.enabled).length,
    [states],
  );

  const preview = (state: LockChangePayload) => {
    void invoke("preview_osd", {
      key: state.key,
      enabled: !state.enabled,
    });
  };

  const toggleOsdEnabled = (key: LockKeyId, enabled: boolean) => {
    setOsdEnabled((current) => ({ ...current, [key]: enabled }));
  };

  const toggleAutostart = (enabled: boolean) => {
    const previous = autostartEnabled ?? true;
    setAutostartEnabled(enabled);
    void invoke<boolean>("set_autostart_enabled", { enabled })
      .then(setAutostartEnabled)
      .catch(() => setAutostartEnabled(previous));
  };

  const isCustomTheme = !BUILTIN_THEMES.some((t) => t.id === theme.id);

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div className="brand-lockup">
          <img alt="" className="brand-logo" src={logoUrl} />
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
        </div>
        {appVersion && <span className="version-badge">v{appVersion}</span>}
      </header>

      <section className="settings-options">
        <label className="option-toggle">
          <input
            checked={autostartEnabled ?? true}
            type="checkbox"
            onChange={(event) => toggleAutostart(event.currentTarget.checked)}
          />
          <span>{text.startAtLogin}</span>
          <strong>{autostartEnabled ?? true ? "ON" : "OFF"}</strong>
        </label>
        <label className="option-toggle">
          <input
            checked={suppressFullscreenOsd}
            type="checkbox"
            onChange={(event) =>
              setSuppressFullscreenOsd(event.currentTarget.checked)
            }
          />
          <span>{text.hideInFullscreen}</span>
          <strong>{suppressFullscreenOsd ? "ON" : "OFF"}</strong>
        </label>
      </section>

      <section className="status-band">
        <div>
          <span>{text.status}</span>
          <strong>
            {enabledCount}/{states.length}
          </strong>
        </div>
        <div className="status-band-position">
          <span>{text.position}</span>
          <strong>{positionLabel(text, osdPosition)}</strong>
        </div>
      </section>

      <section className="position-picker" aria-label={text.position}>
        {OSD_POSITIONS.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={positionLabel(text, id)}
            aria-pressed={osdPosition === id}
            className={`position-cell ${
              osdPosition === id ? "is-selected" : ""
            }`}
            onClick={() => setOsdPosition(id)}
          >
            <span className="position-cell-dot" />
          </button>
        ))}
      </section>

      <section className="theme-section" aria-label={text.theme}>
        <div className="theme-row">
          <span className="theme-row-label">{text.theme}</span>
          {BUILTIN_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={t.name}
              aria-pressed={theme.id === t.id}
              className={`theme-dot ${
                theme.id === t.id ? "is-selected" : ""
              }`}
              style={{ background: t.accent }}
              onClick={() => setTheme(t)}
            />
          ))}
          <button
            type="button"
            aria-label={text.themeCustom}
            aria-pressed={isCustomTheme}
            className={`theme-dot is-custom ${
              isCustomTheme ? "is-selected" : ""
            }`}
            onClick={() =>
              setTheme({
                id: CUSTOM_THEME_ID,
                name: text.themeCustom,
                accent: theme.accent,
                isDark: true,
              })
            }
          />
          <span className="theme-spacer" />
          <input
            type="color"
            aria-label={text.customColor}
            value={theme.accent}
            onChange={(event) =>
              setTheme({
                id: CUSTOM_THEME_ID,
                name: text.themeCustom,
                accent: event.currentTarget.value,
                isDark: true,
              })
            }
          />
        </div>
      </section>

      <section className="settings-grid" aria-label={text.osd}>
        {states.map((state) => (
          <article className="key-row" key={state.key}>
            <LockIcon icon={state.icon} enabled={state.enabled} />
            <div className="key-copy">
              <span>{state.abbreviation}</span>
              <strong>{state.name}</strong>
            </div>
            <span className={state.enabled ? "state-chip on" : "state-chip off"}>
              {state.enabled ? "ON" : "OFF"}
            </span>
            <label className="toggle">
              <input
                checked={osdEnabled[state.key]}
                type="checkbox"
                onChange={(event) =>
                  toggleOsdEnabled(state.key, event.currentTarget.checked)
                }
              />
              <span>{text.show}</span>
            </label>
            <button className="preview-button" type="button" onClick={() => preview(state)}>
              {text.preview}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function LockIcon({
  icon,
  enabled,
}: {
  icon: LockKeyId;
  enabled: boolean;
}) {
  return (
    <span className={`lock-icon ${icon} ${enabled ? "enabled" : "disabled"}`}>
      {icon === "caps" && <span>{enabled ? "ABC" : "abc"}</span>}
      {icon === "num" && <span>123</span>}
      {icon === "scroll" && (
        <span className="scroll-lines">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}

function readStoredOsdEnabled(): OsdEnabledMap {
  try {
    const value = window.localStorage.getItem(osdEnabledStorageKey);
    if (!value) {
      return defaultOsdEnabled;
    }

    const parsed = JSON.parse(value) as Partial<OsdEnabledMap>;
    return {
      caps: typeof parsed.caps === "boolean" ? parsed.caps : true,
      num: typeof parsed.num === "boolean" ? parsed.num : true,
      scroll: typeof parsed.scroll === "boolean" ? parsed.scroll : true,
    };
  } catch {
    return defaultOsdEnabled;
  }
}

function persistOsdEnabled(settings: OsdEnabledMap) {
  window.localStorage.setItem(osdEnabledStorageKey, JSON.stringify(settings));
}

function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(themeStorageKey);
    if (!raw) return BUILTIN_THEMES[0];
    const parsed = JSON.parse(raw) as Partial<Theme>;
    if (
      typeof parsed.accent === "string" &&
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.isDark === "boolean"
    ) {
      return parsed as Theme;
    }
    return BUILTIN_THEMES[0];
  } catch {
    return BUILTIN_THEMES[0];
  }
}

function persistTheme(theme: Theme) {
  window.localStorage.setItem(themeStorageKey, JSON.stringify(theme));
}

function readStoredBoolean(key: string, fallback: boolean) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value) === true;
  } catch {
    return fallback;
  }
}

function persistBoolean(key: string, value: boolean) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isLanguage(value: string): value is Language {
  return value === "en" || value === "zh" || value === "pt";
}

function isOsdPosition(value: string): value is OsdPositionId {
  return (OSD_POSITIONS as string[]).includes(value);
}

function detectBrowserLanguage(): Language {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("pt")) return "pt";
  return "en";
}

type TextPack = (typeof copy)[Language];

function positionLabel(text: TextPack, id: OsdPositionId): string {
  switch (id) {
    case "topLeft":
      return text.positionTopLeft;
    case "topCenter":
      return text.positionTopCenter;
    case "topRight":
      return text.positionTopRight;
    case "bottomLeft":
      return text.positionBottomLeft;
    case "bottomCenter":
      return text.positionBottomCenter;
    case "bottomRight":
      return text.positionBottomRight;
  }
}

export default App;
