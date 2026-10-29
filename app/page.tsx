import { redirect } from "next/navigation";

/** The portal home is the colleague's own page. */
export default function Home() {
	redirect("/my");
}
