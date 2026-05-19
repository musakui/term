export type ServerMsg =
	| { type: 'err'; msg: string }
	| { type: 'exit'; code: number }
