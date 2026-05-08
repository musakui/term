import { createServer } from 'node:http'

import { WebSocketServer } from 'ws'

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
		//
	} catch (err) {
		console.log(`[ws] error ${err}`)
		ws.send(JSON.stringify({ type: 'err', message: `${err}` }))
		ws.close()
	}
})

server.listen(PORT, () => {
	console.log(`server running on port ${PORT}`)
})
