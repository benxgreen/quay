import "./skip-link.css";

/** The first thing on every page: jumps keyboard users past the header to `#main`. */
export function SkipLink({ href = "#main" }: { href?: string }) {
	return (
		<a className="bcp-skip-link" href={href}>
			Skip to main content
		</a>
	);
}
