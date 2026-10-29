import type { HaloUser } from "@/lib/clients/halo/users";
import type {
	HaloAssignedDevice,
	HaloEndOfLifeDevice,
	HaloStockDevice,
} from "@/services/replacements/laptops/lib/halo";

/**
 * Made-up Halo data for development, lining up with db/seed/dev.sql: the
 * report includes devices that already have cases (hidden on Import), one
 * replaced before the portal (29001) and new ones; the stock includes the
 * boxes the seed allocates.
 */
export const MOCK_END_OF_LIFE_DEVICES: HaloEndOfLifeDevice[] = [
	// Already in the workflow (open cases in the seed)
	eol(
		"31877",
		"006943877382",
		"IT-o5wESMGWkoRv",
		"Priya Hart",
		"priya.hart@bcpcouncil.test",
		"Surface Laptop 2",
		"2019-03-14",
		0,
	),
	eol(
		"31818",
		"049249813478",
		"IT-dZ4U2KWoWLXE",
		"Amira Shah",
		"amira.shah@bcpcouncil.test",
		"Surface Laptop 2",
		"2019-02-02",
		1,
	),
	eol(
		"31940",
		"061977228654",
		"IT-tr7crGNtSesx",
		"Ben Whitaker",
		"ben.whitaker@bcpcouncil.test",
		"Surface Pro 6",
		"2019-05-20",
		0,
	),
	// Replaced before the portal (lr.previous_replacements)
	eol(
		"29001",
		"051234998761",
		"IT-Pv3Lr8sWq2Tn",
		"Gareth Lowe",
		"gareth.lowe@bcpcouncil.test",
		"Surface Laptop 2",
		"2018-11-30",
		12,
	),
	// New and eligible
	eol(
		"31990",
		"012678233399",
		"IT-RyzShXaXsHFL",
		"Jordan Blake",
		"jordan.blake@bcpcouncil.test",
		"Surface Laptop 2",
		"2019-01-08",
		0,
	),
	eol(
		"31991",
		"052497844099",
		"IT-99W6SVBnkBj9",
		"Leah Turner",
		"leah.turner@bcpcouncil.test",
		"Surface Pro 6",
		"2019-01-15",
		0,
	),
	eol(
		"31992",
		"083344120871",
		"IT-Fh2KpX9mNb4C",
		"Hannah Price",
		"hannah.price@bcpcouncil.test",
		"Surface Laptop 2",
		"2019-02-21",
		3,
	),
	eol(
		"31993",
		"071209384756",
		"IT-Qz7RwT5vLs1D",
		"Mohammed Ali",
		"mohammed.ali@bcpcouncil.test",
		"Surface Pro 6",
		"2019-04-02",
		1,
	),
	eol(
		"31994",
		"065512983340",
		"IT-Bn4YtR8cXe6F",
		"Sophie Grant",
		"sophie.grant@bcpcouncil.test",
		"Surface Laptop 2",
		"2019-04-17",
		6,
	),
	// Needs attention: no assigned user, and an assigned user whose account is disabled
	eol(
		"31995",
		"090011223344",
		"IT-Uj2NcM7pZx3H",
		null,
		null,
		"Surface Laptop 2",
		"2019-03-01",
		40,
	),
	eol(
		"31996",
		"090011223355",
		"IT-Kt8BvF4hQw2J",
		"Peter Long",
		"peter.long@bcpcouncil.test",
		"Surface Pro 6",
		"2019-03-09",
		90,
	),
];

export const MOCK_STOCK: HaloStockDevice[] = [
	// Allocated to cases in the seed; still in stock in Halo until the replacement is completed
	stock("45855", "081580635802", "IT-HLdvJ5dCfWsd", "Surface Pro 7+"),
	stock("45821", "081580635811", "IT-EmQg3VxMbCGK", "Surface Laptop 5"),
	stock("45790", "081580635829", "IT-Mj3tFTMjnFus", "Surface Laptop 5"),
	stock("45848", "081580635837", "IT-W2pXr7KcNm4D", "Surface Laptop 5"),
	stock("45770", "081580635845", "IT-Cq8Lx2Vb6Nz1", "Surface Laptop 5"),
	// Available
	stock("45856", "081580635853", "IT-FepCSuKWrcmr", "Surface Laptop 3"),
	stock("45857", "081580635861", "IT-Gr4Tz8Wq1Vx5", "Surface Laptop 5"),
	stock("45858", "081580635879", "IT-Hs5Ua9Xr2Wy6", "Surface Laptop 5"),
	stock("45859", "081580635887", "IT-It6Vb1Ys3Xz7", "Surface Pro 7+"),
	stock("45860", "081580635895", "IT-Ju7Wc2Zt4Ya8", "Surface Laptop 5", "Store B"),
];

/**
 * Halo users, the staff directory. The first three have the Entra object IDs
 * in db/seed/dev.sql, so the mock signed-in users match. Peter Long's account
 * is disabled (Import's Needs attention).
 */
export const MOCK_HALO_USERS: HaloUser[] = [
	person(
		1,
		"John Smith",
		"Desktop Infrastructure Engineer",
		"IT & Programmes",
		true,
		"Karen Doyle",
	),
	person(2, "Priya Hart", "Planning Officer", "Planning", true, "Amira Shah"),
	person(
		3,
		"Alex Morgan",
		"Desktop Infrastructure Engineer",
		"IT & Programmes",
		true,
		"John Smith",
	),
	person(4, "Amira Shah", "GIS Analyst", "Planning"),
	person(5, "Owen Price", "Housing Officer", "Housing"),
	person(6, "Marcus Hale", "Data Analyst", "Finance"),
	person(7, "Ravi Menon", "Building Control Surveyor", "Planning"),
	person(8, "Dan Hughes", "Night Warden", "Housing"),
	person(9, "Chloe Barnes", "Customer Adviser", "Customer Services"),
	person(10, "Ellie Ward", "Licensing Officer", "Licensing"),
	person(11, "Nadia Kowalski", "Social Worker", "Children’s Services"),
	person(12, "Kate Morris", "Accountant", "Finance"),
	person(13, "Tom Fielding", "Parks Officer", "Environment"),
	person(14, "Leah Turner", "Events Coordinator", "Communities"),
	person(15, "Ben Whitaker", "Project Manager", "IT & Programmes"),
	person(16, "Ruth Collins", "Benefits Assessor", "Revenues & Benefits"),
	person(17, "Aisha Begum", "Library Assistant", "Communities"),
	person(18, "Adam Kerr", "Team Leader", "Waste Services"),
	person(19, "Sam Taylor", "Waste Services Officer", "Waste Services"),
	person(20, "Gareth Lowe", "Highways Engineer", "Highways"),
	person(21, "Hannah Price", "Payroll Officer", "Finance"),
	person(22, "Jordan Blake", "Social Worker", "Adult Social Care"),
	person(23, "Mohammed Ali", "Environmental Health Officer", "Environment"),
	person(24, "Sophie Grant", "Communications Officer", "Communities"),
	person(25, "Peter Long", "Coastal Ranger", "Environment", false),
];

/** Every device assigned to a user in Halo, for the Import user details modal. */
export const MOCK_ASSIGNED_DEVICES: Record<string, HaloAssignedDevice[]> = {
	"leah.turner@bcpcouncil.test": [
		{
			assetId: "31991",
			serial: "052497844099",
			hostname: "IT-99W6SVBnkBj9",
			model: "Surface Pro 6",
			lastSeen: daysAgo(0),
		},
		{
			assetId: "33410",
			serial: "072233445566",
			hostname: "IT-Wm3Rk8Tq5Zs2",
			model: "Surface Laptop 5",
			lastSeen: daysAgo(0),
		},
	],
};

function person(
	n: number,
	displayName: string,
	jobTitle: string,
	department: string,
	active = true,
	manager: string | null = null,
): HaloUser {
	const username = displayName.toLowerCase().replace(" ", ".");
	return {
		haloUserId: 1000 + n,
		entraObjectId: `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
		email: `${username}@bcpcouncil.test`,
		displayName,
		firstName: displayName.split(" ")[0],
		username,
		jobTitle,
		department,
		active,
		manager,
	};
}

function eol(
	assetId: string,
	serial: string,
	hostname: string,
	name: string | null,
	email: string | null,
	model: string,
	purchaseDate: string,
	lastSeenDaysAgo: number,
): HaloEndOfLifeDevice {
	return {
		assetId,
		serial,
		hostname,
		model,
		purchaseDate,
		lastSeen: daysAgo(lastSeenDaysAgo),
		assignedUser: name && email ? { name, email } : null,
	};
}

function stock(
	assetId: string,
	serial: string,
	hostname: string,
	model: string,
	room = "Store A",
): HaloStockDevice {
	return { assetId, serial, hostname, model, stockLocation: "Civic Centre", stockRoom: room };
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 86_400_000).toISOString();
}
