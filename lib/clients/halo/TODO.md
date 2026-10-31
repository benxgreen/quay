# Halo client – to do

Revisit once we have API access to BCP's Halo (https://halohub.bcpcouncil.gov.uk, docs at `/apidoc`, swagger at `/api/swagger/v2/swagger.json`).

## Where the settings live now (31 Oct 2026)

Every ID below is now a setting, chosen from Halo's lists: the Halo site, connection test and staff fields in **portal Settings › Halo**, and laptop replacements' reports, asset type, statuses, fields, values and audit notes in **Settings › Halo**. The values below are what the settings started with.

## Found in the test Halo (30 Oct 2026, read-only probes)

Sign-in with client credentials works (`HALO_SCOPE=all`). List pages return at most 50 records, whatever `page_size` asks for.

**Users:** report 566's SQL reads `u.uother2 AS [Job Title]`, `u.uother5 AS [Department]` and `LOWER(u.uadmanager) AS [Manager Email Address]`, which the API returns as `other2`, `other5` and `admanager`; the field mapping uses those (migration 0023).

**Users** (`GET /Users/{id}`): `azureoid` (finding a user by it with `advanced_search` works), `emailaddress`, `firstname`, `surname`, `name`, `inactive`, `login`, `samaccountname`, `admanager`, `departments` (array), `azure_last_login_date`, `site_name`. No job title field seen yet (the replacement report has a "Job Title" column, so it comes from somewhere). Custom fields: 1166 Login username, 1062 UPN, 1145 Users Manager Email, 1140 Team, 1141 Location.

**Laptops** are asset type 1 (6,650 in the test Halo). Asset type fields: 117 Serial Number, 247 Manufacturer, 51 Model, 184 Device Name (hostname), 144 Stock Location, 217 Stock Room, 246 Last Audit Date, 251 Audit Details, 263 Asset Tag, 249 Last Sync Time, 220 Old Asset Number, 250 Exempt from hardware replacement communications. Custom field 1144 Service Unit. The asset's user is in `users` (with `azureoid`). `inventory_number` is the asset number.

**Statuses** (`status_id`): 0 Received (in stock), 1 In Service, 5 Maintenance, 7 Retired, 9 Out of Service, 15 Pending, 16 Imported, 17 Under investigation. There's no status list endpoint (`/AssetStatus` is 404).

**Reports** (`GET /Report/{id}?loadreport=true`, rows under `report.rows`):
- 566 ITP020 Devices Eligible for Replacement (280 rows): Serial Number, Device Hostname, Manufacturer, Model, Full Name, Network Logon, Job Title, Department, Email Address, Manager Email Address, Supplier Purchase Date, Warranty End Date, Last Sync Time. No asset ID or user IDs.
- 765 ITP105 Laptops in Stock (958 rows) and 766 ITP106 Laptops in Stock (Pending) (222): Serial Number, Manufacturer, Model, warranty, cost and budget fields, Stock Location, Stock Room, Last Audit Date, Audit Details, Service Unit, Device Status Name, Ticket Reference. No asset ID or hostname.
- 568 ITP021 Device Provisioned Devices in Replacement Stock: 0 rows.
- 571 ITP022 All Provisioned Laptops with IDs (4,689): ID, Serial Number, Device Hostname, Manufacturer, Model, User Email.

## Decided with Ben (30 Oct 2026)

- **The box number (and every asset ID in the portal) is Halo's asset `id`**, such as 26620. The serial number is the asset's `inventory_number`, the same as its Serial Number field (117); for example serial 000374724657 is asset 26620. The "Asset Tag" field (263) is a bug in Halo; don't use it.
- **Report 566 has no ID column yet**, so the portal reads report 571 (All Provisioned Laptops with IDs) alongside it to get each laptop's ID, and looks up any serial 571 doesn't have.
- **There is no stock report.** The API can list laptops at status 0 Received (in stock) (`GET /Asset?assettype_id=1&assetstatuses=0`, 958 in the test Halo, the same as report 765). Filtering on `status_id` is ignored; `assetstatuses` works.
- **Completion update (new device issued):** status 1 In Service, Stock Location and Stock Room cleared, Last Audit Date (246) today, Audit Details (251) "Device collected by {full_name} - {case_reference}", for example "Device collected by Ellie Ward - LR-000128".
- **Old device returned** (step 5): Stock Room (217) 5 Room 310, Last Audit Date (246) the date it was returned, Audit Details (251) "Device returned by {full_name} - {case_reference}", for example "Device returned by Ellie Ward - LR-000128". The status doesn't change yet.
- **Old device decommissioned** (step 6): status 9 Out of Service, Stock Location (144) 8 Decommissioned, Stock Room (217) 5 Room 310.
- **Asset field values that are lookups are sent as the option's ID:** Stock Location is lookup 518 (1 Warehouse, 2 Refurbished, 3 Chargeable - do not use, 4 Centralised - do not use, 6 Loans, 7 Lifecycle Managed Technology, 8 Decommissioned, 10 Customer Retained Stock, 11 Business as usual, 12 Hardware replacements, 13 Estates & Accomodation). Stock Room is lookup 517 (1 Vendor, 2 Room 2 Cage, 3 Room 411, 4 Room 2, 5 Room 310). Read with `GET /Lookup?lookupid=<id>`.
- **Username** should be the domain form, such as `bcp\ben.green`. No Halo user field holds that: `samaccountname` and custom field 1166 Login username are `first.last`, `login` is the email address, and the on-premises directory path is the old `bbc` domain.
- **Be very careful writing to the test Halo, and log every request in the chat.**

## Confirmed by test writes on asset 26620 (30 Oct 2026)

`POST /Asset` with `[{ "id": 26620, "status_id": …, "fields": [{ "id": 144, "value": 8 }, …] }]` returns 201 and saves exactly what was sent: lookup fields take the option ID, `null` clears a field, dates as `YYYY-MM-DD` come back as `YYYY-MM-DDT00:00:00`. The collected, returned and decommissioned updates were each written and read back, then the laptop was put back to Received (in stock) with the fields empty (Audit Details reads back as an empty string). Halo keeps its own history of those four changes on the asset.

## For Ben to do in Halo

- [ ] Add these columns to report 566 ITP020 Devices Eligible for Replacement: Asset ID, Inventory Number (box number), the assigned user's Halo user ID and Entra object ID (`azureoid`), and whether their account is inactive. This saves two requests a laptop on every Import refresh.
- [ ] **A stock report**, so the Stock page is one request instead of 20. Today the portal lists every laptop at status 0 Received (in stock) (958 in the test Halo, all pools), 50 at a time, because the list API can't filter on Stock Location and doesn't return it. Decide how replacement stock is found: every laptop at status 0 Received (in stock), or only those with Stock Location 12 Hardware replacements (or another pool). The list API doesn't return field values, so filtering 958 laptops on Stock Location needs one request each, over the 700-in-5-minutes limit. A report with Asset ID, Inventory Number, Serial Number, Device Name, Manufacturer, Model, Stock Location and Stock Room for the chosen pool would avoid that.
- [x] Username: not from Halo, which has no domain prefix. It will come from Entra ID (decided 31 Oct 2026).

## Custom fields

Both assets and users carry a lot of BCP custom fields. With API access, search them and decide what the portal reads and writes.

- [ ] List the custom fields on users (`GET /Users/{id}` → `customfields`; `GET /Users?include_custom_fields=<ids>` for lists)
- [ ] List the custom fields on assets (`GET /Asset/{id}` → `fields` and `customfields`; `GET /Asset?include_custom_fields=<ids>`)
- [ ] Map the ones we need into `HaloUser` (`users.ts`) and the laptop device types (`services/replacements/laptops/lib/halo`), with the custom field IDs in one place rather than scattered through requests
- [ ] Check whether any of them answer the open questions below (username, job title, department / service area, stock location and room, audit details)

## Users

- [x] Confirm `advanced_search` on `azureoid` works for finding a user by Entra object ID (it does)
- [x] Which field holds the BCP username: `samaccountname` (`first.last`), with the domain prefix added (see above)
- [ ] Whether `title` is the job title, and "Department" vs "Service area"
- [ ] Whether `azure_last_login_date` is the person's last Microsoft sign-in (Import's "Last sign in")
- [ ] Import checks each assigned user with `findByEmail` (two requests each) when refreshing; with ~64 laptops that is fine under the 700-in-5-minutes limit, but a report that already includes the user's Halo ID, Entra ID and inactive flag would avoid it
- [ ] The Halo web address of an asset and a user, for "Open in Halo" links on Needs attention and the user details dialog
- [ ] Which field holds the manager (`manager_email`?) for the user page's Manager row; `HaloUser.manager` is null from the real API until then

## Laptop replacements

- [x] End-of-life report: 566 ITP020 (`GET /Report/566?loadreport=true`, rows in `report.rows`); columns to add are on Ben's list
- [ ] Stock: the criteria (see Ben's list)
- [x] Status IDs and the fields the completion update sets (see "Decided with Ben"); written with `POST /Asset` and the `id`
- [x] Old device returned (Room 310 and an audit note) and decommissioned (Out of Service, Decommissioned, Room 310), as two separate updates (see "Decided with Ben")
- [ ] Build `createHttpLaptopHaloClient` on `callHalo` once the above is known, and drop the refusal in `getLaptopHaloClient`

## Access

- [ ] Agree the Halo API application's scopes (`HALO_SCOPE`, `all` until then)
