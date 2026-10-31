import "./impersonation-banner.css";

import type { ContainerWidth } from "@/components/ui/container";
import "@/components/ui/link/link.css";
import { PhaseBanner } from "@/components/ui/phase-banner";

export type Impersonation = {
	/** The person being impersonated. */
	name: string;
	/** Their roles as written on the Users pages, or "Colleague (no role)". */
	roles: string;
	stopHref: string;
};

/**
 * Shown above the header on every page while an Administrator is seeing the
 * portal as someone else, so it's never forgotten. Uses the phase banner.
 */
export function ImpersonationBanner({
	impersonation: { name, roles, stopHref },
	width,
}: {
	impersonation: Impersonation;
	width?: ContainerWidth;
}) {
	return (
		<section className="bcp-impersonation-banner" aria-label="Impersonation">
			<PhaseBanner tag="Impersonating" colour="yellow" width={width}>
				<p>
					You are currently impersonating {name}. They have the roles of {roles}.{" "}
					{/* A plain link: it ends at a route handler, not a page. */}
					<a className="bcp-link" href={stopHref}>
						Stop impersonating
					</a>
				</p>
			</PhaseBanner>
		</section>
	);
}
