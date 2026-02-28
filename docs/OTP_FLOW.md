# Flux OTP — Inscription Gauzian

Documentation technique du processus de vérification par code OTP lors de l'inscription.
Fichiers concernés : `src/auth/handlers.rs`, `src/auth/services.rs`, `src/auth/routes.rs`

---

## Vue d'ensemble

L'inscription se déroule en **3 étapes séquentielles obligatoires** :

```
[1] POST /auth/register/send-otp
        ↓ email validé, OTP envoyé par mail
[2] POST /auth/register/verify-otp
        ↓ OTP correct → temp_token JWT retourné
[3] POST /auth/register/finalize
        ↓ temp_token valide → compte créé, JWT final retourné
```

---

## Étape 1 — Envoi de l'OTP

**Route :** `POST /auth/register/send-otp`
**Handler :** `send_otp_handler` (`handlers.rs:349`)

### Corps de requête
```json
{ "email": "user@example.com" }
```

### Vérifications dans l'ordre

| # | Vérification | Clé Redis | Comportement si échec |
|---|---|---|---|
| 1 | Format email valide | — | 400 Bad Request |
| 2 | Cooldown anti-spam | `otp_cooldown:{email}` TTL 30s | 429 Too Many Requests |
| 3 | Compteur tentatives | `otp_attempts:{email}` | 429 si ≥ 5 tentatives |
| 4 | Email pas déjà en DB | — (SQL) | 400 "Email already registered" |

### Actions si tout est valide
1. Génère un OTP : 6 caractères alphanumériques majuscules (A-Z, 0-9)
2. Envoie l'email via SMTP
3. Hash l'OTP avec **Argon2id** et stocke dans Redis
4. Pose le cooldown 30 secondes

### Clés Redis posées
| Clé | Valeur | TTL |
|---|---|---|
| `otp:{email}` | hash Argon2 de l'OTP | **600s (10 min)** |
| `otp_cooldown:{email}` | `"cooldown"` | **30s** |

> **Note :** L'email informe l'utilisateur que le code est valide 10 minutes — cohérent avec le TTL Redis.

---

## Étape 2 — Vérification de l'OTP

**Route :** `POST /auth/register/verify-otp`
**Handler :** `verify_otp_handler` (`handlers.rs:426`)

### Corps de requête
```json
{ "email": "user@example.com", "otp": "A3K9BZ" }
```

### Vérifications dans l'ordre

| # | Vérification | Clé Redis | Comportement si échec |
|---|---|---|---|
| 1 | Compteur tentatives | `otp_attempts:{email}` | 429 si ≥ 5 |
| 2 | OTP valide (Argon2) | `otp:{email}` | 401 + incrémente compteur |

### Si OTP invalide
- Incrémente `otp_attempts:{email}` (TTL 600s posé à la première erreur)
- Après 5 échecs → l'étape 1 (envoi) est également bloquée pour le même email

### Si OTP valide
1. Génère un **temp_token** JWT signé (HS256, contient `email` + `jti` + `exp`)
2. Supprime `otp:{email}` de Redis
3. Stocke le temp_token dans Redis

### Clés Redis mises à jour
| Clé | Action | TTL |
|---|---|---|
| `otp:{email}` | **supprimé** | — |
| `temp_token:{email}` | temp_token JWT stocké | **600s (10 min)** |

---

## Étape 3 — Finalisation de l'inscription

**Route :** `POST /auth/register/finalize`
**Handler :** `finalize_registration_handler` (`handlers.rs:502`)

### Corps de requête
```json
{
  "email": "user@example.com",
  "username": "monpseudo",
  "password": "MonMot2P@sse!",
  "temp_token": "<jwt>",
  "encrypted_private_key": "...",
  "public_key": "...",
  "private_key_salt": "...",
  "iv": "...",
  "encrypted_record_key": "..."
}
```

### Vérifications dans l'ordre

| # | Vérification | Mécanisme | Comportement si échec |
|---|---|---|---|
| 1 | Rate limit par IP | `ratelimit:register:{ip}` ≥ 5 / 15 min | 429 |
| 2 | Format email | — | 400 |
| 3 | temp_token non vide | — | 401 |
| 4 | JWT temp_token valide | Signature HS256 + `exp` + `email` matching | 401 |
| 5 | temp_token présent dans Redis | `temp_token:{email}` existe | 401 "OTP verification required" |
| 6 | temp_token Redis == temp_token envoyé | Comparaison exacte | 401 "Invalid temp token" |
| 7 | Mot de passe valide | Règles métier (≥10 chars, maj, chiffre, spécial) | 400 |

### Double vérification du temp_token (étape 4 + 5 + 6)
La sécurité repose sur deux niveaux complémentaires :
- **JWT** : garantit l'intégrité cryptographique et l'expiration
- **Redis** : garantit l'unicité (un seul usage possible, invalidation côté serveur)

### Actions si tout est valide
1. Hash le mot de passe avec Argon2id
2. Crée l'utilisateur en PostgreSQL
3. Génère le JWT final (10 jours)
4. Nettoyage Redis (voir ci-dessous)

### Nettoyage Redis à la fin
| Clé | Action |
|---|---|
| `otp_attempts:{email}` | supprimée (`DEL`) |
| `otp_cooldown:{email}` | supprimée (`DEL`) |
| `temp_token:{email}` | supprimée (`DEL`) |

---

## Récapitulatif des clés Redis

| Clé | Posée par | Expire | Rôle |
|---|---|---|---|
| `otp:{email}` | `send_otp_handler` | 600s | OTP hashé (Argon2) |
| `otp_cooldown:{email}` | `send_otp_handler` | 30s | Anti-spam envoi |
| `otp_attempts:{email}` | `verify_otp_handler` (1er échec) | 600s | Compteur anti-brute-force |
| `temp_token:{email}` | `verify_otp_handler` | 600s | Token post-vérification |
| `ratelimit:login:{email}` | `login_handler` | 900s | Anti-brute-force login |
| `ratelimit:register:{ip}` | `finalize_registration_handler` | 900s | Anti-spam inscription |
| `revoked:{jti}` | `logout_handler` | 864000s | Blacklist JWT révoqués |

---

## Schéma de séquence

```
Client                    Backend                     Redis                  SMTP
  |                          |                           |                    |
  |-- POST /send-otp ------->|                           |                    |
  |                          |-- EXISTS otp_cooldown --> |                    |
  |                          |<-- false ---------------  |                    |
  |                          |-- GET otp_attempts -----> |                    |
  |                          |<-- 0 -----------------    |                    |
  |                          |-- SQL: email exists? -->  |                    |
  |                          |<-- false                  |                    |
  |                          |-- [génère OTP] ------------------------------>  |
  |                          |<-- OK ---------------------------------------- |
  |                          |-- SET_EX otp:email ------> |                   |
  |                          |-- SET_EX otp_cooldown --> |                    |
  |<-- 200 OK --------------|                           |                    |
  |                          |                           |                    |
  |-- POST /verify-otp ----->|                           |                    |
  |                          |-- GET otp_attempts -----> |                    |
  |                          |<-- 0                      |                    |
  |                          |-- GET otp:email ---------> |                   |
  |                          |<-- hash_argon2            |                    |
  |                          |-- [Argon2::verify] -----  |                    |
  |                          |-- [génère temp_token JWT] |                    |
  |                          |-- DEL otp:email ---------> |                   |
  |                          |-- SET_EX temp_token -----> |                   |
  |<-- 200 {temp_token} ----|                           |                    |
  |                          |                           |                    |
  |-- POST /finalize ------->|                           |                    |
  |  {temp_token, ...}       |-- GET ratelimit:register  |                    |
  |                          |-- [verify JWT temp_token] |                    |
  |                          |-- GET temp_token:email --> |                   |
  |                          |<-- <token>                |                    |
  |                          |-- [compare tokens] -----  |                    |
  |                          |-- [Argon2 hash pwd] ----  |                    |
  |                          |-- SQL: INSERT user -----  |                    |
  |                          |-- [génère JWT final] ---  |                    |
  |                          |-- DEL otp_attempts ------> |                   |
  |                          |-- SET_EX temp_token "" --> |  ⚠️ voir bugs     |
  |<-- 200 {token, user_id} |                           |                    |
```

---

## Sécurité — Points forts

- **OTP hashé (Argon2id)** avant stockage Redis : même compromission de Redis n'expose pas l'OTP en clair
- **Double vérification temp_token** : JWT (crypto) + Redis (révocation serveur)
- **Compteur partagé send/verify** : 5 échecs de vérification bloquent aussi l'envoi d'un nouvel OTP (anti-spam)
- **Cooldown 30s** : empêche le spam d'emails
- **Fail-closed sur blacklist JWT** : si Redis est indisponible lors d'un accès authentifié, accès refusé (pas de bypass possible)
- **Rate limit inscription par IP** : 5 tentatives / 15 min

---

## Point d'attention

### 🟡 Absence d'atomicité verify → delete OTP
Entre `verify_otp` (lecture + comparaison) et `delete_otp` (suppression), il n'y a pas de transaction Redis atomique. Deux requêtes simultanées avec le même OTP valide pourraient théoriquement toutes deux passer la vérification avant que l'une supprime la clé. Risque quasi-nul en pratique (fenêtre de race de quelques microsecondes + compteur d'échecs), mais une implémentation via `GETDEL` ou un script Lua serait plus rigoureuse.

---

## Constantes de configuration

```rust
// services.rs
MAX_LOGIN_ATTEMPTS: u32 = 5           // tentatives max login et OTP
RATE_LIMIT_WINDOW_SECONDS: u64 = 900  // 15 min (login et register IP)

// Implicites (non centralisées)
OTP_TTL: 600s               // 10 min
OTP_COOLDOWN_TTL: 30s       // 30s
OTP_ATTEMPTS_TTL: 600s      // 10 min (mis à la première erreur)
TEMP_TOKEN_REDIS_TTL: 600s  // 10 min (aligné avec JWT exp)
TEMP_TOKEN_JWT_EXP: 600s    // 10 min
JWT_FINAL_EXP: 864000s      // 10 jours
BLACKLIST_TTL: 864000s      // 10 jours (= durée de vie JWT)
```
