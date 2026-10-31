"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ACCESS } from "@/lib/portal/access";
import {
	createCase,
	lookUpDevice,
	lookUpPerson,
} from "@/services/replacements/laptops/lib/add-case";
import { LAPTOPS_SECTIONS } from "@/services/replacements/laptops/navigation";

export type AddCaseValues = {
	serial: string;
	same: string;
	email: string;
	type: string;
	next: string;
};

export type FoundDevice = {
	serial: string;
	assetId: string;
	hostname: string;
	model: string;
	assignedName: string | null;
	assignedEmail: string | null;
	assignedJob: string | null;
	assignedDepartment: string | null;
	problem: string | null;
};

export type FoundPerson = {
	email: string;
	name: string;
	jobTitle: string | null;
	department: string | null;
};

export type AddCaseState = {
	values: AddCaseValues;
	device?: FoundDevice;
	person?: FoundPerson;
	errors: Partial<Record<keyof AddCaseValues, string>>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The Add a case form: "Find device", "Find person" and "Add case" all
 * submit here, told apart by the button pressed. Every lookup is done again
 * on "Add case", so nothing from the browser is trusted.
 */
export async function addCaseStep(state: AddCaseState, formData: FormData): Promise<AddCaseState> {
	const user = await requireRole(ACCESS.laptops);
	const values: AddCaseValues = {
		serial: String(formData.get("serial") ?? "").trim(),
		same: String(formData.get("same") ?? ""),
		email: String(formData.get("email") ?? "")
			.trim()
			.toLowerCase(),
		type: String(formData.get("type") ?? ""),
		next: String(formData.get("next") ?? ""),
	};
	const intent = String(formData.get("intent") ?? "add");
	const errors: AddCaseState["errors"] = {};

	// Keep what was found while the field still says the same thing.
	let device = state.device?.serial === values.serial ? state.device : undefined;
	let person = state.person?.email === values.email ? state.person : undefined;

	if (intent === "find-device" || (intent === "add" && !device)) {
		if (!values.serial) {
			errors.serial = "Enter the serial number of the laptop being replaced";
		} else {
			const found = await lookUpDevice(values.serial, user.actorId);
			if (!found.found) errors.serial = found.message;
			else {
				device = {
					serial: values.serial,
					assetId: found.device.assetId,
					hostname: found.device.hostname,
					model: found.device.model,
					assignedName:
						found.assignedUser?.displayName ?? found.device.assignedUser?.name ?? null,
					assignedEmail:
						found.assignedUser?.email ?? found.device.assignedUser?.email ?? null,
					assignedJob: found.assignedUser?.jobTitle ?? null,
					assignedDepartment: found.assignedUser?.department ?? null,
					problem: found.assignedUser
						? found.assignedUser.active
							? found.problem
							: `${found.assignedUser.displayName}’s account is disabled.`
						: (found.problem ??
							"The assigned user was not found in the staff directory."),
				};
				if (device.problem) errors.serial = device.problem;
			}
		}
	}

	if (values.same === "no" && (intent === "find-person" || (intent === "add" && !person))) {
		if (!values.email)
			errors.email = "Enter the email address of the person receiving the laptop";
		else if (!EMAIL.test(values.email))
			errors.email = "Enter an email address in the correct format";
		else if (values.email === device?.assignedEmail) {
			errors.email = "This is the assigned user. Choose ‘Yes’ instead";
		} else {
			const found = await lookUpPerson(values.email, user.actorId);
			if (!found) errors.email = "No one with this email address is in the staff directory";
			else if (!found.active) errors.email = `${found.displayName}’s account is disabled`;
			else {
				person = {
					email: values.email,
					name: found.displayName,
					jobTitle: found.jobTitle,
					department: found.department,
				};
			}
		}
	}

	if (intent !== "add") return { values, device, person, errors };

	if (values.same !== "yes" && values.same !== "no") {
		errors.same = "Select whether the person receiving the laptop is the assigned user";
	}
	if (values.type !== "collection" && values.type !== "session") errors.type = "Select the type";
	if (values.next !== "queue" && values.next !== "book") errors.next = "Select what happens next";
	if (Object.keys(errors).length > 0 || !device || (values.same === "no" && !person)) {
		return { values, device, person, errors };
	}

	// Look both people up again, so the case is built from Halo, not the form.
	const fresh = await lookUpDevice(values.serial, user.actorId);
	const assigned = fresh.found ? fresh.assignedUser : null;
	const receiver = values.same === "no" ? await lookUpPerson(values.email, user.actorId) : null;
	if (!fresh.found || !assigned || (values.same === "no" && !receiver)) {
		return {
			values,
			device,
			person,
			errors: { serial: "The laptop or person could not be found again. Try again." },
		};
	}
	const result = await createCase(
		{
			device: fresh.device,
			assignedUser: assigned,
			receiver,
			type: values.type as "collection" | "session",
		},
		user.actorId,
	);
	if (!result.ok) return { values, device, person, errors: { serial: result.error } };
	if (values.next === "book") redirect(`${LAPTOPS_SECTIONS.cases.href}/${result.reference}/book`);
	redirect(`${LAPTOPS_SECTIONS.import.href}/queue?addedCase=${result.id}`);
}
