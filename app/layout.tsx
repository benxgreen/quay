import "@/components/ui/bcp-design-system.css";

import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import type { ReactNode } from "react";

const roboto = Roboto({
	subsets: ["latin"],
	weight: ["400", "500", "700"],
	variable: "--bcp-font-roboto",
	display: "swap",
});

export const metadata: Metadata = {
	title: {
		template: "%s – Quay | BCP Council",
		default: "- Quay | BCP Council",
	},
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en-GB" className={roboto.variable}>
			<body>{children}</body>
		</html>
	);
}
