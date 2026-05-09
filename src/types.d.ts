export type ClientMsg =
	| 'ping'
	| { data: string }
	| { rows: number; cols: number }

export type ServerMsg =
	| 'pong'
	| { type: 'err'; msg: string }
	| { type: 'out'; data: string }
	| { type: 'exit'; code: number }
