# Ninja Shot

Screenshot app built with Electron: full-screen or region capture, annotations (text, arrow, highlight, blur), copy to clipboard, save to default directory.

## Requirements

- **Linux (X11):** Screen capture uses **scrot**. Install with:
  ```bash
  sudo apt-get install scrot
  ```
- **Linux (Wayland):**
  - **Sway / wlroots:** Uses **grim**. Install: `sudo apt-get install grim`
  - **GNOME:** Grim fails with "compositor doesn't support wlr-screencopy". The app falls back to **gnome-screenshot** (usually pre-installed). If needed: `sudo apt-get install gnome-screenshot`

## Usage

- **Full screen** / **Select region**: Capture from the home screen.
- **Print Screen**: Global shortcut (configurable in Settings: full screen or region).
- **Editor**: After capture, add text, arrows, highlights, or blur; then **Copy** or **Save**.

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
