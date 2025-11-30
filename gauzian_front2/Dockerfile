# Étapes de build de votre application Next.js
# Ex: 
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Étape finale pour le serveur (Next.js utilise un serveur intégré)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
# Exécute l'application en mode production (doit utiliser le port 3001)
# Définir la variable d'environnement PORT pour que `next start` écoute sur 3001
ENV PORT=3001
EXPOSE 3001
CMD ["npm", "start"]