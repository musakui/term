import { join } from 'node:path'
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'

import { WebSocketServer } from 'ws'
import { spawn } from 'node-pty'

const TERM = 'xterm-256color'
const PORT = Number(process.env.PORT ?? 3141)

const encoder = new TextEncoder()

const shell = process.env.SHELL ?? '/bin/sh'
const shellArgs = ['--login']
const shellOpts = {
	rows: 24,
	cols: 80,
	name: TERM,
	cwd: process.env.HOME ?? process.cwd(),
	env: {
		...process.env,
		COLORTERM: 'truecolor',
		TERM,
	},
}

const server = createServer((req, res) => {
	if (req.url === '/') {
		try {
			const st = createReadStream(join(process.cwd(), 'index.html'))
			res.writeHead(200, { 'content-type': 'text/html' })
			st.pipe(res)
		} catch (err) {
			res.writeHead(500).end(JSON.stringify(err))
		}
		return
	} else if (req.url === '/status') {
		res.writeHead(200).end('"ok"')
		return
	}

	res.writeHead(404).end('"not found"')
})

const wss = new WebSocketServer({
	server,
	path: '/sh',
})

wss.on('connection', (ws, req) => {
	console.log(`[ws] new sh from ${req.socket.remoteAddress}`)

	try {
		createSh(ws)
	} catch (err) {
		console.log(`[ws] error ${err}`)
		ws.send(JSON.stringify({ type: 'err', message: `${err}` }))
		ws.close()
	}
})

process.on('SIGINT', close)
process.on('SIGTERM', close)

server.listen(PORT, () => {
	console.log(`server running on port ${PORT}`)
})

function close() {
	console.log('\nshutting down')
	server.close()
	process.exit()
}

/** @param {import('ws').WebSocket} ws */
function createSh(ws) {
	const pty = spawn(shell, shellArgs, shellOpts)

	console.log(`[sh] spawned pid=${pty.pid} shell=${shell}`)

	pty.onData((data) => ws.send(encoder.encode(data)))

	pty.onExit(({ exitCode }) => {
		console.log(`[sh] pid=${pty.pid} exited code=${exitCode}`)
		ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
		ws.close()
	})

	ws.on('close', () => {
		console.log(`[ws] client disconnected. killing pid=${pty.pid}`)
		eat(() => pty.kill())
	})

	ws.on('error', (err) => {
		console.error('[ws] error:', err.message)
		eat(() => pty.kill())
	})

	ws.on('message', (raw, isBin) => {
		if (isBin) return pty.write(raw)

		const txt = raw.toString()
		if (txt === 'ping') return ws.send('pong')

		try {
			/** @type {Record<string, unknown>} */
			const data = JSON.parse(txt)
			if ('size' in data) {
				/** @type {[number, number]} */
				const sz = data.size
				pty.resize(sz[0], sz[1])
			}
		} catch {
			//
		}
	})
}

/** @param {() => void} fn */
function eat(fn) {
	try {
		fn()
	} catch {
		// eat error
	}
}
