# Ninja Shot

Screenshot app built with Electron: full-screen or region capture, annotations (text, arrow, highlight, blur), copy to clipboard, save to default directory.

## Requirements

- **Linux:** Screen capture needs one of these (the app will prompt to install if missing):
  - **X11:** **scrot** — `sudo apt-get install scrot`
  - **Wayland (Sway/wlroots):** **grim** — `sudo apt-get install grim`
  - **Wayland (GNOME):** **gnome-screenshot** — `sudo apt-get install gnome-screenshot` (often pre-installed)

  When you try to capture and a dependency is missing, Ninja Shot will ask: *"Install it now?"* and can install it for you (you may be asked for your password).

## Usage

- **Full screen** / **Select region**: Capture from the home screen.
- **Print Screen**: Global shortcut (configurable in Settings: full screen or region).
- **Editor**: After capture, add text, arrows, highlights, or blur; then **Copy** or **Save**.
- The app uses a **frameless** window with a custom title bar (drag to move; buttons to minimize, maximize, close). **Quit**: `Ctrl+Q` (Windows/Linux) or `Cmd+Q` (macOS).

## Where screenshots are saved

When you click **Save**, files are written to your system’s **Pictures** folder, in a **Screenshots** subfolder:

- **Linux:** `~/Pictures/Screenshots/`
- **macOS:** `~/Pictures/Screenshots/`
- **Windows:** `%USERPROFILE%\Pictures\Screenshots\`

Filenames look like: `ninja-shot-1739366400000.png`. You can see the exact path in **Settings**.

## Development

```bash
npm start
```

## Build

```bash
npm run make
```
