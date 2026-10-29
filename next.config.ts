import type { NextConfig } from "next";

// Next.js dev mode uses eval() for HMR/debugging (React never uses it in
// production), so 'unsafe-eval' is only added outside production.
const scriptSrc =
	process.env.NODE_ENV === "production"
		? "script-src 'self' 'unsafe-inline'"
		: "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const contentSecurityPolicy = [
	"default-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	scriptSrc,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self'",
	"connect-src 'self'",
].join("; ");

const securityHeaders = [
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
	{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
	{ key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
	poweredByHeader: false,
	reactStrictMode: true,
	devIndicators: false,
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
