# LinkSnap

A full-stack URL shortener with click analytics, Redis-cached redirects, link expiration and QR codes.

## Features

- User signup and login (JWT stored in an httpOnly cookie)
- Shorten a URL, with an optional custom alias
- Fast redirects using Redis (cache-aside pattern)
- Dashboard listing all your links with click counts
- Per-link analytics: clicks over time, devices, browsers, referrers, countries
- Link expiration by date or by click limit
- QR code for every short link (view and download)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), Tailwind CSS, Recharts, Axios |
| Backend | Node.js, Express |
| Database | MongoDB Atlas (Mongoose) |
| Cache | Redis (Upstash) via ioredis |
| Auth | JWT in httpOnly cookie, bcryptjs |
| Libraries | nanoid, qrcode, geoip-lite, ua-parser-js |

## Architecture

```
Browser (Next.js, :3000)  --->  Express API (:4000)  --->  MongoDB Atlas
                                       |
                                       +--->  Redis (Upstash)
```

Redirect flow (`GET /:shortCode`):
1. Look up `link:<shortCode>` in Redis.
2. On a hit, use the cached data. On a miss, read MongoDB and store the result in Redis with a TTL.
3. Reject disabled or expired links with `410 Gone`.
4. Log the click (device, browser, referrer, country) without blocking the redirect.
5. Respond with `302` to the original URL.

If Redis is down, the app falls back to MongoDB.

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Create an account |
| POST | `/api/auth/login` | No | Log in |
| POST | `/api/auth/logout` | No | Clear the cookie |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/links` | Yes | Create a short link |
| GET | `/api/links` | Yes | List my links |
| GET | `/api/links/:id/analytics?days=7` | Yes | Analytics for a link |
| GET | `/api/links/:id/qr` | Yes | QR code (base64 PNG) |
| GET | `/:shortCode` | No | Redirect to the original URL |

## Running Locally

Requirements: Node.js 18+, a MongoDB Atlas cluster, an Upstash Redis database.

```bash
# Backend
cd server
cp .env.example .env     # then fill in your values
npm install
npm run dev

# Frontend (new terminal)
cd client
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## Design Decisions

- **Separate frontend and backend:** the redirect endpoint needs a long-running server for low latency.
- **Links reference users, clicks reference links:** unbounded one-to-many data is never embedded.
- **`clickCount` stored on each link:** cheap dashboard reads, and a Click collection for detailed analytics.
- **302 redirects, not 301:** a 301 would be cached by browsers and clicks would not be counted.
- **Atomic `$inc` and conditional updates:** click limits stay correct under concurrent clicks.
- **QR codes encode the short URL,** so scans are counted and respect expiry.