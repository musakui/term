import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

/** @type {'command' | 'shell'} */
let mode = 'command'

/** user input buffer */
let buf = ''

/** @type {WebSocket | null} */
let ws = null

/** @type {ReturnType<typeof setInterval> | null} */
let pingTimer = null

/** @param {string} c */
const _e = (c) => `\x1b[${c}`

/**
 * @param {number} n
 * @param {string} s
 */
const _c = (n, s) => `${_e(`${n}m`)}${s}${_e('0m')}`

const PROMPT = _c(33, '\n> ')

const term = new Terminal({
	cursorBlink: true,
	cursorStyle: 'bar',
})

term.onResize((size) => send(size))

term.onData((data) => {
	if (mode === 'command') {
		for (const char of data) {
			handleChar(char)
		}
	} else if (mode === 'shell') {
		send({ data })
	}
})

const el = document.getElementById('terminal')

term.open(el)

const oriRect = document.querySelector('.xterm-screen')?.getBoundingClientRect()
const charWidth = (oriRect?.width ?? 660) / 80
const charHeight = (oriRect?.height ?? 432) / 24
const ro = new ResizeObserver((et) => resize(et[0].contentRect))

resize(el.getBoundingClientRect())
ro.observe(el)

term.writeln(_c(2, 'usage: connect [ws://host:port]'))
term.write(PROMPT)

/** @param {string} char */
function handleChar(char) {
	// Backspace
	if (char === '\x7f') {
		if (!buf.length) return
		buf = buf.slice(0, -1)
		term.write('\b \b')
		return
	}

	// Enter
	if (char === '\r') {
		term.writeln('')
		const ln = buf.trim()
		buf = ''
		if (ln) {
			runCommand(...ln.split(/\s+/))
		} else {
			term.write(PROMPT)
		}
		return
	}

	// Ctrl+C
	if (char === '\x03') {
		buf = ''
		term.writeln('')
		term.write(PROMPT)
	}

	// non-printable
	if (char < ' ') return

	buf += char
	term.write(char)
}

/**
 * @param {string} cmd
 * @param {...string} args
 */
function runCommand(cmd, ...args) {
	switch (cmd.toLowerCase()) {
		case 'connect': {
			const ss = location.protocol === 'https:' ? 'wss:' : 'ws:'
			const url = args[0] || `${ss}//${location.host}/sh`
			connect(url)
			break
		}
		case 'clear': {
			term.clear()
			term.write(PROMPT)
			break
		}
		case 'reload': {
			location.reload()
			break
		}
		default: {
			term.writeln(_c(31, `unknown command: ${cmd}`))
			term.write(PROMPT)
		}
	}
}

/** @param {string} url */
function connect(url) {
	term.writeln(_c(2, '⬡ connecting…'))
	ws = new WebSocket(url)
	mode = 'pending'
	buf = ''

	ws.addEventListener('open', () => {
		mode = 'shell'
		pingTimer = setInterval(() => ws.send('"ping"'), 15_000)
	})

	ws.addEventListener('error', (err) => {
		console.log('error', err)
		term.writeln(`\n${_c(31, `[error] could not connect to "${url}"`)}`)
		mode = 'command'
		term.write(PROMPT)
	})

	ws.addEventListener('close', () => {
		term.writeln(`\n\r${_c(33, `[disconnected]`)}`)
		if (pingTimer !== null) {
			clearInterval(pingTimer)
			pingTimer = null
		}
		mode = 'command'
		term.write(PROMPT)
	})

	ws.addEventListener('message', ({ data }) => {
		if (data === '"pong"') return
		/** @type {import('./types').ServerMsg}*/
		let msg
		try {
			msg = JSON.parse(data)
		} catch (err) {
			return
			//
		}

		if (msg.type === 'out') {
			term.write(msg.data)
		} else if (msg.type === 'err') {
			term.writeln(`\n${_c(31, `[error] ${msg.message}`)}`)
		} else if (msg.type === 'exit') {
			term.writeln(`\n${_c(33, `[shell exited with code ${msg.code}]`)}`)
		}
	})
}

/** @param {import('./types').ClientMsg} msg */
function send(msg) {
	if (ws?.readyState !== 1) return
	ws.send(JSON.stringify(msg))
}

/** @param {DOMRectReadOnly} rect */
function resize(rect) {
	term.resize(Math.floor(rect.width / charWidth), Math.floor(rect.height / charHeight))
}
