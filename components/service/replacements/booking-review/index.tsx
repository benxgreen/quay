"use client";

import "@/components/ui/button/button.css";
import "./booking-review.css";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Link, LinkButton } from "@/components/ui/link";
import { Modal } from "@/components/ui/modal";
import { Note } from "@/components/ui/note";
import { Tag } from "@/components/ui/tag";

export type ReviewItem = {
	bookingId: string;
	reference: string;
	name: string;
	/** Such as "Mon 9 Nov, 7:00am · Collection · Box 45816". */
	detail: string;
	href: string;
};

/**
 * Mockups: AdminBookingsReviewModal. A note at the top of the dashboard
 * whenever bookings from past days are still marked Booked, with a modal
 * listing them, each opening its case in a new tab. Coming back to this
 * tab refreshes the list: a booking that has been dealt with shows as done,
 * and once none are left the note says so rather than vanishing mid-review.
 */
export function BookingReview({
	items,
	listHref,
}: {
	items: ReviewItem[];
	/** The Incomplete bookings view, the same bookings as a list. */
	listHref: string;
}) {
	const router = useRouter();
	// The list as it was when the page opened, so finished ones stay in place.
	const [first] = useState(items);
	const remaining = new Set(items.map((item) => item.bookingId));
	const list = [
		...first,
		...items.filter((item) => !first.some((f) => f.bookingId === item.bookingId)),
	];
	const done = list.filter((item) => !remaining.has(item.bookingId)).length;

	useEffect(() => {
		const refresh = () => {
			if (document.visibilityState === "visible") router.refresh();
		};
		document.addEventListener("visibilitychange", refresh);
		return () => document.removeEventListener("visibilitychange", refresh);
	}, [router]);

	if (!list.length) return null;
	const count = `${list.length} past ${list.length === 1 ? "booking" : "bookings"}`;
	const outstanding = items.length;

	return (
		<Note>
			{/* A div, not a p: the modal's dialog can't sit inside a paragraph. */}
			<div>
				{outstanding ? (
					<>
						<strong>
							{outstanding} {outstanding === 1 ? "booking" : "bookings"} from past
							days
						</strong>{" "}
						{outstanding === 1 ? "has" : "have"} not been updated.{" "}
					</>
				) : (
					<>
						<strong>All bookings from past days have been updated.</strong>{" "}
					</>
				)}
				<Modal
					caption="Bookings"
					title={`${count} to review`}
					trigger={(open) => (
						<LinkButton type="button" onClick={open}>
							{!outstanding
								? "View the list"
								: outstanding === 1
									? "Review it"
									: "Review them"}
						</LinkButton>
					)}
					footerStart={
						<span className="bcp-secondary-text" aria-live="polite">
							{done} of {list.length} done
						</span>
					}
				>
					<p>
						These bookings have passed but the replacement has not been completed. Open
						each case to complete the replacement, or record that the person did not
						attend.
					</p>
					<ol className="bcp-booking-review">
						{list.map((item) => (
							<li key={item.bookingId} className="bcp-booking-review-item">
								<div>
									<strong>{item.name}</strong>{" "}
									<span className="bcp-secondary-text">{item.reference}</span>
									<span className="bcp-booking-review-detail bcp-secondary-text">
										{item.detail}
									</span>
								</div>
								{remaining.has(item.bookingId) ? (
									<a
										className="bcp-button bcp-button--secondary bcp-button--small"
										href={item.href}
										target="_blank"
										rel="noopener"
									>
										Open case
										<span className="sr-only">
											{" "}
											for {item.name} (opens in new tab)
										</span>
									</a>
								) : (
									<Tag colour="green">Done</Tag>
								)}
							</li>
						))}
					</ol>
					<p className="bcp-secondary-text">
						Cases open in a new tab. This list updates as each one is done.
					</p>
				</Modal>
				{outstanding ? (
					<>
						{" "}
						or <Link href={listHref}>see them as a list</Link>
					</>
				) : null}
			</div>
		</Note>
	);
}
