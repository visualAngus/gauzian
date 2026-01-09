# --- CHANGEMENT ICI : On utilise la version "latest" stable, pas la 1.75 ---
FROM rust:slim-bookworm as builder

WORKDIR /app

# Installation des dépendances système (OpenSSL)
RUN apt-get update && apt-get install -y pkg-config libssl-dev

# Copie des fichiers de dépendances
COPY Cargo.toml Cargo.lock ./

# On crée un main dummy pour compiler les dépendances (mise en cache Docker)
RUN mkdir src && echo "fn main() {}" > src/main.rs

RUN cargo build --release

# Maintenant on copie ton vrai code source
COPY . .

# Mode offline pour SQLx (car pas d'accès DB au build)
#ENV SQLX_OFFLINE=true

# On touche le main pour forcer la recompilation du code source
RUN touch src/main.rs
RUN cargo build --release

# ÉTAPE 2 : Le Runner (Image finale légère)
FROM debian:bookworm-slim

WORKDIR /app

# Certificats SSL et libs runtime
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

# Copie du binaire compilé
COPY --from=builder /app/target/release/gauzian_back ./server

# Exposition du port
EXPOSE 3000

# Lancement
CMD ["./server"]