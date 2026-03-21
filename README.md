# Interactive Plan Builder PRO+

A web-based interactive map with hotspots, zooming, panning, and project management.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Then open http://localhost:3000 in your browser.

## Project Structure

```
CarteInteractive/
├── server.js              # Express backend (uploads, save/load)
├── package.json           # Node.js dependencies & scripts
├── public/                # Frontend assets
│   ├── index.html         # Main page
│   ├── app.js             # Client-side logic
│   └── styles.css         # Styling
├── uploads/               # Uploaded image files (generated at runtime)
├── data/                  # Saved projects (generated at runtime)
│   └── project.json       # Current project data
└── README.md              # This file
```

## Features

- **Pan & Zoom**: Click-drag to pan, scroll to zoom (centered on cursor)
- **Hotspots**: Click to create hotspots on the plan image
- **Admin Mode**: Create, edit, delete hotspots; upload images per hotspot
- **Viewer Mode**: View hotspot details and gallery
- **Persistence**: Save/load projects via JSON

## API Routes

### `POST /upload`
Upload an image file for a hotspot.

**Request:**
```
Content-Type: multipart/form-data
file: <binary file>
```

**Response:**
```
/uploads/<filename>
```

### `POST /save`
Save the current project (plan image + all hotspots).

**Request:**
```json
{
  "image": "data:image/png;base64,...",
  "hotspots": [
    {
      "id": 1234567890,
      "x": 0.5,
      "y": 0.3,
      "title": "Room A",
      "color": "#ff0000",
      "desc": "Description",
      "images": ["/uploads/xxxxx", "/uploads/yyyyy"]
    }
  ]
}
```

**Response:**
```
ok
```

Saved to `data/project.json`.

### `GET /project`
Retrieve the saved project JSON.

**Response:**
```json
{
  "image": "data:image/png;base64,...",
  "hotspots": [...]
}
```

## Usage

### As Admin
1. Click "Login Admin"
2. Double-click the plan to create a hotspot
3. Fill in title, color, description, and upload images
4. Click "OK" to save
5. Click "💾 Save" to persist to server

### As Viewer
1. Click "Login Viewer" (default mode)
2. Click any hotspot to view details and gallery
3. Zoom/pan as needed

### Load a Saved Project
1. Click "📂 JSON" and select a previously saved `project.json` file
2. The plan and hotspots will reload

## Server Configuration

Default port: **3000** (configurable via `PORT` env variable)

```bash
# Custom port
PORT=8080 npm start
```

## Notes

- Images uploaded via hotspots are stored in `uploads/` folder
- Base64 plan images are embedded in the saved JSON (no separate file)
- All hotspot metadata (title, color, description) is stored in `data/project.json`
