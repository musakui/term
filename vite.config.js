import { defineConfig } from 'vite'

export default defineConfig({
	server: {
		proxy: {
			'/sh': { target: 'ws://localhost:3141', ws: true },
		},
	},
})
