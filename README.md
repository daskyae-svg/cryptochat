# CryptoChat

Full-stack encrypted chat app with:

- Node.js + Express backend
- MySQL/MariaDB via `mysql2`
- Socket.io realtime messaging
- AES-256-CBC encrypted messages
- 1-to-1 WebRTC calls with screen sharing
- Direct messages, group chats, images, GIFs, typing indicators, and profile settings

## Project Layout

```text
CryptoChat/
├─ src/
│  ├─ cryptoUtils.js
│  ├─ db.js
│  └─ server.js
├─ server/
│  └─ client/
│     ├─ css/
│     ├─ js/
│     └─ *.html
├─ sql/
│  └─ schema.sql
├─ package.json
└─ README.md
```

## New Features

### Screen Sharing

- Calls now start with camera + microphone
- Screen sharing uses `navigator.mediaDevices.getDisplayMedia()`
- The existing `RTCPeerConnection` is reused
- Video switching uses `RTCRtpSender.replaceTrack()`
- When the shared screen ends, the app automatically switches back to the camera

### Group Chat

- Create groups from the sidebar
- Add members from the group chat menu
- Group messages use the same AES helpers already used for direct chat
- Realtime group rooms are handled with Socket.io room names like `group_<id>`

## Database Schema

The app auto-creates missing tables on startup.

Existing tables:

- `users`
- `messages`

New tables:

- `groups`
- `group_members`
- `group_messages`

If you want to inspect or apply the schema manually, use [sql/schema.sql](/c:/Users/Click/Desktop/CryptoChat/sql/schema.sql).

## API Endpoints

Auth/profile:

- `POST /signup`
- `POST /login`
- `POST /profile/avatar`
- `POST /profile/username`

Direct chat:

- `GET /conversations?userId=<id>`
- `GET /messages/:userId?currentUserId=<id>`
- `POST /send-message`
- `POST /delete-message`

Groups:

- `POST /groups`
- `GET /groups?userId=<id>`
- `POST /groups/:id/add-user`
- `GET /groups/:id/messages?userId=<id>`

Utility:

- `GET /users?exclude=<id>`
- `GET /webrtc-config`
- `GET /gifs/search?q=<term>`
- `GET /health`

## Environment Variables

Create a `.env` file in the project root or provide environment variables another way.

Required:

```bash
AES_KEY_HEX=your_64_hex_character_key
```

Common local development values:

```bash
PORT=3000
CLIENT_ORIGIN=*
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=cryptochat
```

Optional WebRTC/TURN values:

```bash
STUN_URLS=stun:stun.l.google.com:19302
TURN_URLS=turn:your-turn-host:3478,turns:your-turn-host:5349
TURN_USERNAME=your_turn_username
TURN_PASSWORD=your_turn_password
ICE_TRANSPORT_POLICY=all
```

## Run

1. Install dependencies:

```bash
npm install
```

2. Set your database credentials and `AES_KEY_HEX`.

3. Start the app:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

## Notes

- The server bootstraps the database and creates any missing tables.
- Group messages are stored encrypted in `group_messages`.
- Direct chat deletion still works as before.
- Screen sharing requires browser permission for camera, microphone, and display capture.
