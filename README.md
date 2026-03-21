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

## Authentication

The app now uses server-side sessions with a real login page.

- Login URL: `http://localhost:3000/login`
- Main app URL: `http://localhost:3000/` (requires login)

Users are stored in `saves/users.json` with one bcrypt hash per user password.

```bash
ADMIN_PASSWORD_HASH=$2a$...
VIEWER_PASSWORD_HASH=$2a$...
SESSION_SECRET=replace_with_a_long_random_secret
```

You can bootstrap default `admin` / `viewer` users from env hashes, but the recommended workflow is creating users directly:

```bash
npm run create-user -- alice StrongPass123 viewer
npm run create-user -- bob StrongPass123 admin
```

Admins can also manage users directly in the app from the `👤 Users` modal (create/list/edit/delete).

Create users via API (admin session required):

```http
POST /auth/users
Content-Type: application/json

{
  "username": "charlie",
  "password": "StrongPass123",
  "role": "viewer"
}
```

Generate a bcrypt hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('your_password', 12))"
```

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
├── saves/                 # Saved projects + users store (generated at runtime)
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
1. Login with admin credentials
2. Click the plan to create a hotspot
3. Fill in title, point type, description, and upload images
4. Click "OK" to save (autosave is enabled)

### As Viewer
1. Login with viewer credentials
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
