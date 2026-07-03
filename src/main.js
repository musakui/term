import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

/** @type {'command' | 'shell'} */
let mode = 'command'

/** user input buffer */
let buf = 'connect'

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

const PROMPT = _c(33, '\n❯ ')

const MODS = ['ctrl', 'alt']
const DIRS = { u: 'A', d: 'B', r: 'C', l: 'D' }
const KEYS = {
	tab: '\t',
	esc: '\x1b',
}

const activeAttr = 'data-active'
const vv = window.visualViewport
const encoder = new TextEncoder()

const term = new Terminal({
	cursorBlink: true,
	cursorStyle: 'bar',
})

term.onResize((s) => send({ size: [s.cols, s.rows] }))

term.onTitleChange((t) => {
	document.title = t
})

term.onData((data) => {
	if (mode === 'command') {
		for (const char of data) {
			handleChar(char)
		}
	} else if (mode === 'shell') {
		send(applyModifiers(data))
	}
})

const el = document.getElementById('terminal')
const toolbar = document.getElementById('toolbar')
const modKeys = MODS.map((m) => toolbar?.querySelector(`[data-key="${m}"]`))

term.open(el)

const oriRect = document.querySelector('.xterm-screen')?.getBoundingClientRect()
const charWidth = (oriRect?.width ?? 660) / term.cols
const charHeight = (oriRect?.height ?? 432) / term.rows
const ro = new ResizeObserver((et) => resize(et[0].contentRect))

resize(el.getBoundingClientRect())
ro.observe(el)

term.writeln(_c(2, 'usage: connect [ws://host:port]'))
term.write(PROMPT)
term.write(buf)

vv?.addEventListener('resize', repositionToolbar)
vv?.addEventListener('scroll', repositionToolbar)
toolbar?.addEventListener('pointerdown', (evt) => {
	/** @type {HTMLButtonElement} */
	const key = evt.target?.closest('button')
	const k = key?.dataset.key
	if (!k) return
	evt.preventDefault()

	if (MODS.includes(k)) {
		key.toggleAttribute(activeAttr)
		return
	}

	if (k in DIRS) {
		const [c, a] = getModifiers()
		send(_e(`${c || a ? `1;${c && a ? 7 : c ? 5 : 3}` : ''}${DIRS[k]}`))
	} else if (k in KEYS) {
		send(applyModifiers(KEYS[k]))
	}
})

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
	mode = 'pending'
	buf = ''

	ws = new WebSocket(url)
	ws.binaryType = 'arraybuffer'

	ws.addEventListener('open', () => {
		mode = 'shell'
		pingTimer = setInterval(() => ws.send('ping'), 15_000)
		send({ size: [term.cols, term.rows] })
		document.body.setAttribute('data-connected', '')
	})

	ws.addEventListener('error', (err) => {
		console.log('error', err)
		term.writeln(`\n${_c(31, `[error] could not connect to "${url}"`)}`)
		returnToCommand()
	})

	ws.addEventListener('close', () => {
		term.writeln(`\n\r${_c(33, `[disconnected]`)}`)
		if (pingTimer !== null) {
			clearInterval(pingTimer)
			pingTimer = null
		}
		returnToCommand()
	})

	ws.addEventListener('message', ({ data }) => {
		if (data === 'pong') return

		if (data instanceof ArrayBuffer) {
			term.write(new Uint8Array(data))
			return
		}

		/** @type {import('./types').ServerMsg}*/
		let msg
		try {
			msg = JSON.parse(data)
		} catch (err) {
			return
			//
		}

		if (msg.type === 'err') {
			term.writeln(`\n${_c(31, `[error] ${msg.message}`)}`)
		} else if (msg.type === 'exit') {
			term.writeln(`\n${_c(33, `[shell exited with code ${msg.code}]`)}`)
		}
	})
}

/** @param {string | Record<string, unknown>} msg */
function send(msg) {
	if (ws?.readyState !== 1) return
	ws.send(typeof msg === 'string' ? encoder.encode(msg) : JSON.stringify(msg))
}

function returnToCommand() {
	document.body.removeAttribute('data-connected')
	mode = 'command'
	term.write(PROMPT)
	for (const k of modKeys) {
		k?.removeAttribute(activeAttr)
	}
}

/** @param {DOMRectReadOnly} rect */
function resize(rect) {
	term.resize(Math.floor(rect.width / charWidth), Math.floor(rect.height / charHeight))
}

function repositionToolbar() {
	if (!vv || !toolbar) return
	// offsetTop accounts for any scroll offset of the visual viewport
	const b = window.innerHeight - vv.height - vv.offsetTop
	toolbar.style.transform = b > 0 ? `translateY(-${b}px)` : ''
}

function getModifiers() {
	return modKeys.map((k) => {
		if (!k) return false
		const active = k.hasAttribute(activeAttr)
		if (active) k.removeAttribute(activeAttr)
		return active
	})
}

/** @param {string} data */
function applyModifiers(data) {
	if (data.length > 1) return data
	const [ctrl, alt] = getModifiers()
	const c = ctrl ? getCode(data) : data
	return alt ? '\x1b' + c : c
}

/** @param {string} data */
function getCode(data) {
	const c = data.charCodeAt(0)
	return c < 0x40 || c > 0x7e ? data : String.fromCharCode(c & 0x1f)
}
