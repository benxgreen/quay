import { redirect } from "next/navigation";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

/** The service opens on the engineers' bookings dashboard. */
export default function LaptopReplacementsPage() {
	redirect(LAPTOPS_SECTIONS.bookings.href);
}
