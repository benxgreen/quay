import "./footer.css";

import EmblemLogo from "@/components/icons/organisations/bcp-emblem";
import { Container, type ContainerWidth } from "@/components/ui/container";

export type FooterLink = { text: string; href: string };

/** The council-wide links, as in Harbour. Cookies points at the site's own page. */
export const DEFAULT_FOOTER_LINKS: FooterLink[] = [
	{ text: "Disclaimer", href: "https://www.bcpcouncil.gov.uk/disclaimer" },
	{ text: "Privacy", href: "https://www.bcpcouncil.gov.uk/privacy" },
	{ text: "Cookies", href: "/cookies" },
	{ text: "Accessibility statement", href: "https://www.bcpcouncil.gov.uk/accessibility" },
];

/** Standard links on the left, the BCP mark on the right. */
export function Footer({
	links = DEFAULT_FOOTER_LINKS,
	width = "large",
}: {
	links?: FooterLink[];
	width?: ContainerWidth;
}) {
	return (
		<footer className="bcp-footer">
			<Container width={width}>
				<div className="bcp-footer-inner">
					<h2 className="sr-only">Support links</h2>
					<ul className="bcp-footer-links">
						{links.map((link) => (
							<li key={link.href}>
								<a href={link.href}>{link.text}</a>
							</li>
						))}
					</ul>
					<div className="bcp-footer-logo">
						<EmblemLogo />
					</div>
				</div>
			</Container>
		</footer>
	);
}
