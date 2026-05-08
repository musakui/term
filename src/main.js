import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import './styles.css'

const term = new Terminal({
	cursorBlink: true,
	cursorStyle: 'bar',
})

const el = document.getElementById('terminal')

term.open(el)

term.writeln('> hello world')
