import { defineConfig } from "vite";

export default defineConfig({
	optimizeDeps: {
		include: ["slidev-addon-ws-syncho > qr-code-styling"],
	},
});
