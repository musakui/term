# term

> remote terminal

A container that serves a webpage with a terminal into itself.

## Usage

Mount the current folder at `/workspace` and expose at port `8080`

```sh
docker run -p 8080:3141 -e HOME=/workspace -v ./:/workspace ghcr.io/musakui/term:latest
```

## Stack

- [`Xterm.js`](https://xtermjs.org/)
- [`node-pty`](https://github.com/microsoft/node-PTY)
- [`node:alpine`](https://hub.docker.com/_/node)

with some help from [`ws`](https://github.com/websockets/ws) and [`vite`](https://vite.dev/)
