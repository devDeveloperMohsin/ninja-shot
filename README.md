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
  On **Linux**, some window managers may still draw their own title bar; if you see a double title bar, you can try disabling client-side/window decorations for Ninja Shot in your desktop’s window settings.

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

Built installers appear under `out/make/` (e.g. `.deb` on Linux, Squirrel on Windows, `.zip` on macOS).

### Install the .deb on Ubuntu/Debian

Ubuntu Software may show “File not supported” for local `.deb` files. Install from the terminal instead:

```bash
# Find the .deb (e.g. under out/make/ or out/make/deb/<arch>/)
sudo dpkg -i path/to/ninja-shot_*_amd64.deb   # use arm64 on ARM machines
sudo apt-get install -f   # fix any missing dependencies
```

Then run **Ninja Shot** from your app menu or with `ninja-shot`.
