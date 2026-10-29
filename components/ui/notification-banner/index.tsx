import "./notification-banner.css";

import type { ReactNode } from "react";
import { useId } from "react";

export type NotificationBannerVariant = "success" | "important" | "failed";

const DEFAULT_TITLES: Record<NotificationBannerVariant, string> = {
	success: "Success",
	important: "Important",
	failed: "Failed",
};

type NotificationBannerProps = {
	variant?: NotificationBannerVariant;
	/** The bold summary line, for example "Booking confirmed". */
	heading: ReactNode;
	/** Overrides the small title bar text ("Success", "Important" or "Failed"). */
	title?: string;
	children?: ReactNode;
};

/**
 * Banner at the top of the page. Success confirms what the person just did;
 * Failed says a call to Halo, the decommission hook or Power Automate did
 * not work and nothing changed; Important is something the colleague needs
 * to know first, such as a cancelled session.
 *
 * Success and Failed are announced as alerts because they follow an action.
 * In a Failed banner, wrap the error detail in a paragraph with
 * NotificationBannerDetail.
 *
 * @example
 * <NotificationBanner variant="success" heading="Booking confirmed">
 *   <p>Your session is on Thursday 12 November 2026 at 9:30am.</p>
 * </NotificationBanner>
 */
export function NotificationBanner({
	variant = "important",
	heading,
	title,
	children,
}: NotificationBannerProps) {
	const titleId = useId();
	const isAlert = variant !== "important";

	return (
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: alert and region both take aria-labelledby; the rule cannot read the conditional role
		<div
			className={`bcp-notification-banner bcp-notification-banner--${variant}`}
			role={isAlert ? "alert" : "region"}
			aria-labelledby={titleId}
		>
			<h2 className="bcp-notification-banner-title" id={titleId}>
				{title ?? DEFAULT_TITLES[variant]}
			</h2>
			<div className="bcp-notification-banner-content">
				<p className="bcp-notification-banner-heading">{heading}</p>
				{children}
			</div>
		</div>
	);
}

/** The grey error detail line in a Failed banner, such as "Halo returned 503 Service Unavailable at 9:52am." */
export function NotificationBannerDetail({ children }: { children: ReactNode }) {
	return <p className="bcp-notification-banner-detail">{children}</p>;
}
