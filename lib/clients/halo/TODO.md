# Halo client – to do

Revisit once we have API access to BCP's Halo (https://halohub.bcpcouncil.gov.uk, docs at `/apidoc`, swagger at `/api/swagger/v2/swagger.json`).

## Custom fields

Both assets and users carry a lot of BCP custom fields. With API access, search them and decide what the portal reads and writes.

- [ ] List the custom fields on users (`GET /Users/{id}` → `customfields`; `GET /Users?include_custom_fields=<ids>` for lists)
- [ ] List the custom fields on assets (`GET /Asset/{id}` → `fields` and `customfields`; `GET /Asset?include_custom_fields=<ids>`)
- [ ] Map the ones we need into `HaloUser` (`users.ts`) and the laptop device types (`services/replacements/laptops/lib/halo`), with the custom field IDs in one place rather than scattered through requests
- [ ] Check whether any of them answer the open questions below (username, job title, department / service area, stock location and room, audit details)

## Users

- [ ] Confirm `advanced_search` on `azureoid` works for finding a user by Entra object ID
- [ ] Which field holds the BCP username: `login`, `samaccountname` or a custom field
- [ ] Whether `title` is the job title, and "Department" vs "Service area"
- [ ] Which field holds the manager (`manager_email`?) for the user page's Manager row; `HaloUser.manager` is null from the real API until then

## Laptop replacements

- [ ] End-of-life and stock report IDs (published report via `GET /ReportData/{id}`, or `GET /Report/{id}?loadreport=true`) and the stock criteria
- [ ] Status IDs and the fields the completion update sets (`GET /Asset/{id}`, then `POST /Asset` with the `id`), including clearing stock location and room and setting audit details
- [ ] What changes when the old device is marked returned
- [ ] Which request decommission is, and what it sends
- [ ] Build `createHttpLaptopHaloClient` on `callHalo` once the above is known, and drop the refusal in `getLaptopHaloClient`

## Access

- [ ] Agree the Halo API application's scopes (`HALO_SCOPE`, `all` until then)
