FROM node:24.22.1-alpine

RUN apk upgrade --no-cache && apk add --no-cache tzdata
# npm 11.21.1 still bundles Undici 6.29.0; apply the compatible security patch.
RUN npm install --global npm@11.21.1 --ignore-scripts \
    && npm install --prefix /tmp/npm-security-patch --ignore-scripts --package-lock=false undici@6.29.1 \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici \
    && cp -a /tmp/npm-security-patch/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/undici \
    && rm -rf /tmp/npm-security-patch
ENV TZ=Asia/Bangkok

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
