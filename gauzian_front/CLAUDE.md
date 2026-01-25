# CLAUDE.md - Frontend

This file provides guidance to Claude Code (claude.ai/code) when working with the Nuxt.js frontend.

## Build & Run

```bash
npm install                # Install dependencies
npm run dev                # Dev server (localhost:3000)
npm run build              # Production build
npm run preview            # Preview production build
```

## Architecture

```
app/
├── pages/
│   ├── login.vue          # Auth (login + register)
│   ├── drive.vue          # Main file manager
│   └── info.vue           # User info & crypto testing
├── composables/
│   ├── useAuth.js         # Auth state
│   └── drive/             # File operations composables
├── utils/
│   └── crypto.ts          # Client-side encryption (CORE)
└── components/            # Vue components
```

## Crypto (crypto.ts)

- **RSA-4096** for key exchange
- **AES-256-GCM** for file/metadata encryption
- **PBKDF2** (100k iterations) for password key derivation
- Keys in IndexedDB as non-extractable CryptoKey objects

## API Calls

```typescript
await fetch(`${API_URL}/endpoint`, {
  method: "POST",
  credentials: "include",  // Required for cookies
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

## Security Fixes Needed

- Remove `console.log` with sensitive data (crypto.ts, info.vue)
- Increase PBKDF2 iterations to 310,000
- Add CSRF token to requests
