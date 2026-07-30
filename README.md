# Keyboard Lock OSD

[简体中文](./README.zh-CN.md)
[Português (BR)](#português)

Keyboard Lock OSD is a lightweight Windows utility that shows a compact on-screen indicator for Caps Lock, Num Lock, and Scroll Lock changes. It stays in the system tray, reacts immediately to lock-key input, and keeps the current state visible across single-monitor and multi-monitor setups without interrupting your typing flow.

## Download

[Download the latest Windows release](https://github.com/coderDJing/keyboard-lock-osd/releases/latest). Open the latest release and download the Windows `.exe` installer.

## Screenshots

### Caps Lock OSD Overlay

![Keyboard Lock OSD Caps Lock overlay screenshot](./docs/images/en/overlay.png)

### Settings Window

![Keyboard Lock OSD settings screenshot](./docs/images/en/settings.png)

## Features

- Instant feedback for Caps Lock, Num Lock, and Scroll Lock state changes.
- Dark glassmorphism OSD overlay with a subtle green glow when a lock key is active.
- Configurable OSD position with six anchors (top/bottom × left/center/right) — change is applied live to all monitors.
- Multi-monitor friendly: each connected display gets its own OSD window, with display changes synced automatically.
- Per-key controls for choosing which lock keys should show an overlay.
- Settings window with current key states, position picker, and built-in overlay preview.
- Tray-first startup with optional start at login.
- Optional fullscreen suppression for games, presentations, and video playback.
- English, Chinese (zh), and Portuguese (pt) UI, auto-detected from the system locale.
- Signed auto-updates through GitHub Releases in release builds.

## Português

Indicador de teclas de bloqueio (Caps/Num/Scroll Lock) para Windows, similar ao do Dell Display and Peripheral Manager. Mostra um OSD discreto no centro inferior da tela sempre que você pressiona essas teclas.

- Posição configurável (6 opções: superior/inferior × esquerdo/central/direito).
- Suporte a múltiplos monitores.
- Inicia com o Windows (opcional).
- Não interfere em tela cheia (jogos, vídeos, apresentações).
- Interface em Português Brasileiro detectada automaticamente.

## How To Use

1. Launch the app. It starts minimized to the system tray.
2. Press Caps Lock, Num Lock, or Scroll Lock to see the state overlay.
3. Click the tray icon to open settings.
4. Adjust start at login, fullscreen suppression, per-key overlay visibility, and the OSD position (3×2 grid picker).

## Who It Is For

- Laptop users whose keyboards do not have visible lock-key indicators.
- External keyboard users who often miss Caps Lock or Num Lock changes.
- Multi-monitor desktop users who want the state hint visible on every active screen.
- Windows users who want clear lock-key feedback without interrupting input.

## Development

```powershell
pnpm install
pnpm tauri dev
```

## Validation

```powershell
pnpm run build
cargo check --manifest-path src-tauri/Cargo.toml
```
