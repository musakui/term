FROM node:24-alpine AS pty-builder

RUN apk add --no-cache make g++ python3 linux-headers

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:24-alpine AS app-builder

WORKDIR /app
COPY package.json ./
RUN sed -i '/node-pty/d' package.json && npm install
COPY . ./
RUN npm run build

FROM node:24-alpine

LABEL org.opencontainers.image.source=https://github.com/musakui/term
LABEL org.opencontainers.image.description="remote terminal"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /app

RUN apk add --no-cache libstdc++

COPY --from=pty-builder /app/node_modules ./node_modules
COPY --from=app-builder /app/dist/index.html ./index.html

COPY package.json ./
COPY server.js ./

EXPOSE 3141

CMD ["node", "server.js"]
