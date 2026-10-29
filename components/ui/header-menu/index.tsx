"use client";

import "@/components/ui/link/link.css";
import "./header-menu.css";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Container, type ContainerWidth } from "@/components/ui/container";
import { Header } from "@/components/ui/header";

export type HeaderMenuLink = { text: string; href: string };

export type HeaderMenuGroup = { title: string; links: HeaderMenuLink[] };

type HeaderMenuProps = {
	homeHref: string;
	homeLabel?: string;
	width?: ContainerWidth;
	/** Columns of links, each under a heading. */
	groups: HeaderMenuGroup[];
};

/**
 * The Header with a "Menu" button on the right. The menu opens under the
 * header and pushes the page down (it is not a dropdown).
 *
 * The button is a disclosure: aria-expanded says whether the menu is open.
 * Escape closes it and returns focus to the button. It also closes when a
 * link in it is followed and whenever the route changes, including with the
 * browser's back and forward buttons.
 *
 * @example
 * <HeaderMenu homeHref="/manage" groups={[{ title: "Services", links: [...] }]} />
 */
export function HeaderMenu({ homeHref, homeLabel, width = "large", groups }: HeaderMenuProps) {
	const [open, setOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuId = useId();

	// Close on route change. Adjusting state during render (rather than in an
	// effect) avoids a frame with the menu still open on the new page.
	const pathname = usePathname();
	const [lastPathname, setLastPathname] = useState(pathname);
	if (pathname !== lastPathname) {
		setLastPathname(pathname);
		setOpen(false);
	}

	useEffect(() => {
		if (!open) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
				buttonRef.current?.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open]);

	return (
		<>
			<Header homeHref={homeHref} homeLabel={homeLabel} width={width} bordered>
				<button
					ref={buttonRef}
					type="button"
					className="bcp-header-menu-button"
					aria-expanded={open}
					aria-controls={menuId}
					onClick={() => setOpen((current) => !current)}
				>
					<span className="bcp-header-menu-chevron" aria-hidden="true" />
					Menu
				</button>
			</Header>
			<div id={menuId} className="bcp-header-menu" hidden={!open}>
				<Container width={width}>
					<nav aria-label="Menu" className="bcp-header-menu-columns">
						{groups.map((group) => (
							<div key={group.title}>
								<h2 className="bcp-header-menu-title">{group.title}</h2>
								<ul className="bcp-header-menu-list">
									{group.links.map((link) => (
										<li key={link.href}>
											<NextLink
												className="bcp-link"
												href={link.href}
												onClick={() => setOpen(false)}
											>
												{link.text}
											</NextLink>
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>
				</Container>
			</div>
		</>
	);
}
