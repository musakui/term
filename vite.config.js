import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		//
		singleFile(),
	],
	server: {
		host: '0.0.0.0',
		proxy: {
			'/sh': { target: 'ws://localhost:3141', ws: true },
		},
		allowedHosts: [
			//
		],
	},
	build: {
		modulePreload: {
			polyfill: false,
		},
		cssCodeSplit: false,
		assetsInlineLimit: 100_000_000,
		chunkSizeWarningLimit: 100_000_000,
	},
})

function singleFile() {
	return /** @type {import('vite').Plugin} */ ({
		name: 'vite:singlefile',
		enforce: 'post',
		generateBundle(_, bundle) {
			const chunk = bundle['index.html']
			let html = chunk.source

			for (const fn of Object.keys(bundle)) {
				if (fn.endsWith('.css')) {
					const reg = new RegExp(`<link[^>]+href=${qt(fn)}[^>]*>`, 'gi')
					if (!reg.test(html)) continue
					html = html.replace(reg, `<style>${bundle[fn].source}</style>`)
				} else if (fn.endsWith('.js')) {
					const ch = bundle[fn]
					if (!ch || ch.type !== 'chunk') continue
					const reg = new RegExp(`<script[^>]+src=${qt(fn)}[^>]*><\/script>`, 'gi')
					if (!reg.test(html)) continue
					html = html.replace(reg, `<script type="module">${ch.code}</script>`)
				}
			}

			chunk.source = html
		},
	})
}

/** @param {string} str */
function qt(str) {
	return `["'][^"']*${str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*["']`
}
