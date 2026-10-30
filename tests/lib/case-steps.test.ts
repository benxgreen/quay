import { currentStep, stepLabel } from "@/services/replacements/laptops/lib/case-steps";

const base = {
	status: "booked" as const,
	boxNumber: "45855",
	devicePreparedAt: new Date(),
	softwarePreparedAt: null,
	softwareRequested: ["Power BI"],
};

describe("case steps", () => {
	it("works out the step from what has been done", () => {
		expect(currentStep({ ...base, boxNumber: null })).toBe(1);
		expect(currentStep({ ...base, devicePreparedAt: null })).toBe(2);
		expect(currentStep(base)).toBe(3);
		expect(currentStep({ ...base, softwarePreparedAt: new Date() })).toBe(4);
		expect(currentStep({ ...base, softwareRequested: [] })).toBe(4);
		expect(currentStep({ ...base, status: "awaiting_return" })).toBe(5);
		expect(currentStep({ ...base, status: "awaiting_decommission" })).toBe(6);
		expect(currentStep({ ...base, status: "completed" })).toBeNull();
	});

	it("waits for the software choice when there is no booking", () => {
		expect(currentStep({ ...base, status: "pending", softwareRequested: null })).toBe(3);
	});

	it("labels the step for the Cases list", () => {
		expect(stepLabel({ ...base, softwarePreparedAt: new Date() })).toBe(
			"Step 4 of 6: ready to complete",
		);
		expect(stepLabel({ ...base, status: "withdrawn" })).toBeNull();
	});
});
