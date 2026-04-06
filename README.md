# Interactive Plan Builder PRO+

Web app for collaborative interactive plans with hotspots, image galleries, and project permissions.

## Quick Start

```bash
npm install
npm start
```

Open: http://localhost:3000

- Login page: `/login`
- App page: `/` (requires authentication)

## Authentication and Roles

The app uses server-side sessions via `express-session`.

Supported roles:
- `viewer`: can browse projects and view hotspots
- `editor`: can create/update hotspots and edit projects based on project access rules
- `admin`: full access, including user administration

Users are stored in `data/users.json`.

Create users from CLI:

```bash
npm run create-user -- alice StrongPass123 viewer
npm run create-user -- bob StrongPass123 editor
npm run create-user -- carol StrongPass123 admin
```

You can also bootstrap default users from environment variables:

```bash
ADMIN_PASSWORD_HASH=$2a$...
VIEWER_PASSWORD_HASH=$2a$...
SESSION_SECRET=replace_with_a_long_random_secret
IMAGE_SIGNING_SECRET=replace_with_a_long_random_secret
```

## Project Access Model

Each project stores:
- `ownerUsername`
- `visibility`: `private` or `public`
- `publicAccess`: `view_only` or `editable`

Rules summary:
- `admin`: can view/edit/manage all projects
- `viewer`: read-only everywhere
- `editor`:
  - private project: only owner can view/edit
  - public + view_only: only owner can edit
  - public + editable: any editor can edit

## Project Structure

```text
carte.qleca.fr/
├── server.js
├── package.json
├── public/
│   ├── index.html
│   ├── app.js
│   ├── login.html
│   └── styles.css
├── data/
│   └── users.json                # created at runtime
├── saves/
│   └── <projectId>.json          # created at runtime
├── uploads/                      # created at runtime
└── scripts/
    └── create-user.js
```

## Main API Routes

Authentication:
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

User management (admin only):
- `GET /auth/users`
- `POST /auth/users`
- `PATCH /auth/users/:username`
- `DELETE /auth/users/:username`

Projects:
- `POST /project/create`
- `GET /projects` (returns `{ myProjects, communityProjects }`)
- `GET /project/:id`
- `POST /save` (update existing project content)
- `POST /project/rename`
- `POST /project/access`
- `POST /project/duplicate`
- `DELETE /project/:id`

Images:
- `POST /upload` (editor/admin)
- `GET /image/:filename?sig=...` (signed private access)
- `GET /image-url?src=...` (maps stored image source to signed URL)

## Notes

- Background plan image is stored as Data URL in each project file.
- Hotspot images are stored in `uploads/` and accessed through signed URLs.
- Default port: `3000` (override with `PORT`).

```bash
PORT=8080 npm start
```
