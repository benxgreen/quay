/**
 * What the app does when the database rejects a change because of one of
 * its rules. The constraint name is in err.constraint (also for the two
 * raised from triggers with USING CONSTRAINT). See "Errors the app should
 * catch" in docs/database-schema.md.
 */
export type ConstraintProblem =
	/** Someone took the last place, or the session was closed or cancelled. Ask for another date. */
	| "session_unavailable"
	/** The case already has a booking. Send them to Rebook. */
	| "already_booked"
	/** The device already has an open case. Show it under Import "Needs attention". */
	| "device_has_open_case"
	/** The box is allocated to another open case. */
	| "box_allocated"
	/** A session of this type already exists at the requested time. */
	| "session_duplicate"
	/** A code path broke a rule the UI should have prevented. Report it as a bug. */
	| "bug";

const CONSTRAINTS: Record<string, { problem: ConstraintProblem; message: string }> = {
	sessions_not_overbooked: {
		problem: "session_unavailable",
		message: "This date is no longer available. Please choose another date.",
	},
	bookings_session_open: {
		problem: "session_unavailable",
		message: "This date is no longer available. Please choose another date.",
	},
	bookings_one_active_per_case: {
		problem: "already_booked",
		message: "This replacement is already booked. Choose a new date to rebook.",
	},
	cases_one_open_per_device: {
		problem: "device_has_open_case",
		message: "This laptop already has an open case.",
	},
	device_allocations_one_open_per_box: {
		problem: "box_allocated",
		message: "That device is already allocated to another case.",
	},
	cases_one_open_per_box: {
		problem: "box_allocated",
		message: "That device is already allocated to another case.",
	},
	sessions_one_per_type_and_time: {
		problem: "session_duplicate",
		message: "There is already a session of this type at this date and time.",
	},
	bookings_session_type_matches: {
		problem: "bug",
		message: "Sorry, there is a problem with the service. Try again later.",
	},
};

export type DescribedConstraintError = {
	constraint: string;
	problem: ConstraintProblem;
	/** A sentence for the page, in the service's own words. */
	message: string;
};

/**
 * Turns a database error into something the page can show, or returns
 * undefined if it is not one of the known rule violations (let it throw).
 *
 * @example
 * try { … } catch (error) {
 *   const problem = describeConstraintError(error);
 *   if (problem?.problem === "session_unavailable") return { error: problem.message };
 *   throw error;
 * }
 */
export function describeConstraintError(error: unknown): DescribedConstraintError | undefined {
	if (typeof error !== "object" || error === null || !("constraint" in error)) {
		return undefined;
	}
	const constraint = (error as { constraint?: unknown }).constraint;
	if (typeof constraint !== "string") {
		return undefined;
	}
	const known = CONSTRAINTS[constraint];
	return known ? { constraint, ...known } : undefined;
}
