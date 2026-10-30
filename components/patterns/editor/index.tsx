import "./editor.css";

import type { ReactNode } from "react";

/**
 * An editor beside its preview, such as an email and how it will look.
 * Two columns on wide screens, one under the other below 900px.
 *
 * @example
 * <Editor><form>…</form><section>…preview…</section></Editor>
 */
export function Editor({ children }: { children: ReactNode }) {
	return <div className="bcp-editor">{children}</div>;
}

/**
 * A whole HTML document shown in a frame, such as a rendered email, so its
 * styles can't affect the page. Sandboxed: no scripts, forms or navigation.
 */
export function EditorFrame({ title, html }: { title: string; html: string }) {
	return <iframe title={title} className="bcp-editor-frame" sandbox="" srcDoc={html} />;
}

/** Code shown as it is, such as the HTML sent to a webhook. */
export function EditorCode({ children }: { children: ReactNode }) {
	return <pre className="bcp-editor-code">{children}</pre>;
}
