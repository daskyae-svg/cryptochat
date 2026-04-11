# CryptoChat

Secure full-stack chat app with:

- Node.js + Express backend
- MariaDB database via `mysql2`
- Socket.io real-time messaging
- SHA-256 + salt password hashing
- AES-256-CBC encrypted messages
- Frontend built with HTML/CSS/JavaScript

## Project Structure

```
CryptoChat/
├─ server/
│  ├─ src/
│  │  ├─ cryptoUtils.js
│  │  ├─ db.js
│  │  └─ server.js
│  ├─ sql/
│  │  └─ schema.sql
│  ├─ .env.example
│  └─ package.json
└─ client/
   ├─ css/
   │  └─ styles.css
   ├─ js/
   │  ├─ api.js
   │  ├─ auth.js
   │  ├─ chat.js
   │  ├─ config.js
   │  ├─ login.js
   │  └─ signup.js
   ├─ chat.html
   ├─ index.html
   ├─ login.html
   └─ signup.html
```

## Database Tables

`users` table:

- `id` (INT, PK, auto increment)
- `username` (VARCHAR, unique)
- `password_hash` (VARCHAR)
- `salt` (VARCHAR)
- `created_at` (timestamp)

`messages` table:

- `id` (INT, PK, auto increment)
- `sender_id` (INT)
- `receiver_id` (INT)
- `message_encrypted` (TEXT)
- `iv` (VARCHAR)
- `created_at` (timestamp)

Tables are auto-created on server startup. SQL is also provided at `server/sql/schema.sql`.

## Environment Variables

Copy `server/.env.example` to `server/.env` and update values:

```bash
SERVER_PORT=3000
CLIENT_ORIGIN=*
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=cryptochat
AES_KEY_HEX=your_64_hex_chars_key
```

`AES_KEY_HEX` must be exactly 64 hex characters (32 bytes) for AES-256-CBC.
Set `CLIENT_ORIGIN` to a specific frontend URL in production (for local development `*` is simplest).

## Run Instructions

1. Install dependencies:

```bash
cd server
npm install
```

2. Configure environment:

```bash
copy .env.example .env
```

3. Start the server:

```bash
npm start
```

4. Open in browser:

```
http://localhost:3000
```

This serves the frontend and backend from the same Express server.

## REST API Endpoints

- `POST /signup`
- `POST /login`
- `POST /send-message`
- `GET /messages/:userId?currentUserId=<loggedInUserId>`

Extra helper endpoint used by UI:

- `GET /users?exclude=<currentUserId>`

## Notes

- Passwords are hashed with SHA-256 + random salt (as required).
- Messages are encrypted with AES-256-CBC before DB storage.
- Every message gets a unique IV.
- Decryption is done when messages are fetched for chat display.
- Socket.io is used for instant real-time delivery.
