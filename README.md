# Layout Maker

Draw and design the floor plan of anything — your restaurant, your grocery
store, your dream house. A pure client-side game: no build step, no server,
no dependencies. Just open `index.html` in a browser.

## Play

Open `layout-maker/index.html` directly in any modern browser (double-click it,
or serve the folder with any static server).

## How it works

1. **Pick your lot size.** Sizes are grouped into two rows:
   - **Standard lots** — Small, Medium, Extra Medium, Large, Extra Large, Extra
     Extra Large, Extra Extra Extra Large, and Extra ×4 Large.
   - **Big builds** — business & institutional scale: Long Business (a wide
     strip-mall storefront), Warehouse, Superstore, School, High School,
     Shopping Mall, and Mega Campus.
   - **Estates & land** — property / grounds scale: Mansion & Grounds, Resort,
     Stadium Complex, Golf Course, Airport, and Small Town (up to 820 × 560
     cells).

   Each card notes what it's roughly sized for and gives you a different grid to
   build on.
2. **Draw the rooms.**
   - **Room tool (`R`)** — click and drag to draw a rectangular room. It snaps
     to the grid and is given its own color automatically.
   - **Shape tool (`P`)** — click to drop points for an irregular room; double-
     click, press Enter, or click the first point again to close it.
3. **Name and recolor.** Every new room gets a name and a color. Select it
   (`V`) to rename it, pick a new color from the palette, duplicate it, or
   delete it. Drag rooms to move them and drag the handles to resize.
4. **Add floors.** Use **+ Floor** to add another storey. Each floor is its own
   blank plan on the same lot; click a floor in the list to switch between them,
   double-click its name to rename it.

## Features

- 8 lot sizes, grid-snapped drawing
- Rectangle and polygon room tools
- Auto-assigned colors + full palette / custom color picker
- Move, resize, duplicate, delete rooms
- Multiple floors you can switch between and rename
- Undo / redo (`Ctrl+Z` / `Ctrl+Y`)
- Pan (drag empty space or middle-mouse) and zoom (wheel, or the zoom buttons)
- Autosaves to your browser (`localStorage`) — reload and **Resume**
- Save / open layouts as `.json` files
- Export the current floor as a `.png` image

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `V` | Select / move |
| `R` | Draw room (rectangle) |
| `P` | Draw shape (polygon) |
| `E` | Delete tool |
| `Delete` / `Backspace` | Delete selected room |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Enter` | Finish polygon |
| `Esc` | Cancel polygon / deselect |
