# Stage 1: Build
FROM node:24.22.1-alpine AS builder

RUN apk upgrade --no-cache \
    && npm install --global npm@11.21.1 --ignore-scripts \
    && npm install --prefix /tmp/npm-security-patch --ignore-scripts --package-lock=false undici@6.29.1 \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici \
    && cp -a /tmp/npm-security-patch/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/undici \
    && rm -rf /tmp/npm-security-patch

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

RUN apk upgrade --no-cache

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
