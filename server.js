import { createServer } from 'node:http'

import { WebSocketServer } from 'ws'
import { spawn } from 'node-pty'

const TERM = 'xterm-256color'
const PORT = Number(process.env.PORT ?? 3141)

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
	//
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
	if (req.url !== '/sh') {
		ws.close()
		return
	}

	console.log(`[ws] new sh from ${req.socket.remoteAddress}`)

	try {
		createSh(ws)
	} catch (err) {
		console.log(`[ws] error ${err}`)
		ws.send(JSON.stringify({ type: 'err', message: `${err}` }))
		ws.close()
	}
})

server.listen(PORT, () => {
	console.log(`server running on port ${PORT}`)
})

/** @param {import('ws').WebSocket} ws */
function createSh(ws) {
	/** @param {import('./src/types').ServerMsg} msg */
	const send = (msg) => ws.send(JSON.stringify(msg))

	const pty = spawn(shell, shellArgs, shellOpts)

	console.log(`[sh] spawned pid=${pty.pid} shell=${shell}`)

	pty.onData((data) => send({ type: 'out', data }))
	pty.onExit(({ exitCode }) => {
		console.log(`[sh] pid=${pty.pid} exited code=${exitCode}`)
		send({ type: 'exit', code: exitCode })
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

	ws.on('message', (raw) => eat(() => handle(JSON.parse(raw.toString()))))

	/** @param {import('./src/types').ClientMsg} msg */
	function handle(msg) {
		if (msg === 'ping') {
			send('pong')
		} else if ('cols' in msg) {
			pty.resize(msg.cols, msg.rows)
		} else {
			pty.write(msg.data)
		}
	}
}

/** @param {() => void} fn */
function eat(fn) {
	try {
		fn()
	} catch {
		// eat error
	}
}
