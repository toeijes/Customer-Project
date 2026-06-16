FROM node:20-alpine

RUN apk add --no-cache tzdata
ENV TZ=Asia/Bangkok

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
