#build stage
FROM node:24-slim AS build
WORKDIR /app

COPY ./package-lock.json ./
COPY ./package.json ./
RUN npm ci
COPY . ./
ARG VITE_API_URL=/api
RUN npm run build

#serve stage
FROM caddy:2
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
