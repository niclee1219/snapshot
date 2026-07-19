import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	turbopack: {
		// Silences the multi-lockfile workspace-root warning.
		root: __dirname,
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
