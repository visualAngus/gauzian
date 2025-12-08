# 1. Base commune (L'environnement OS)
FROM rust:1-slim-bookworm as base
WORKDIR /app
# Installation des dépendances système requises (OpenSSL est souvent nécessaire)
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# 2. Stage de Développement (avec Hot Reload)
FROM base as dev
# On installe cargo-watch pour recompiler automatiquement quand le code change
RUN cargo install cargo-watch
# La commande par défaut lance le mode "watch"
CMD ["cargo", "watch", "-x", "run"]

# 3. Stage de Builder (Pour compiler la version prod)
FROM base as builder
# On copie les manifestes d'abord pour mettre en cache les dépendances
COPY Cargo.toml Cargo.lock ./
# On crée un main dummy pour forcer le téléchargement des crates sans compiler ton code
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
# Maintenant on copie ton vrai code
COPY . .
# On "touch" le main pour forcer la recompilation
RUN touch src/main.rs
RUN cargo build --release

# 4. Stage de Caddy Builder (Pour construire Caddy avec le module rate-limit)
FROM debian:bookworm-slim as prod
WORKDIR /app
RUN apt-get update && apt-get install -y libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# On copie JUSTE le serveur Rust
COPY --from=builder /app/target/release/gauzian /app/server

EXPOSE 8080
CMD ["/app/server"]