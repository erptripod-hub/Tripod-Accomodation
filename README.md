# Accommodation Module

Bedspace-level accommodation tracking for Tripod Group — UAE and KSA entities.

## Contents

```
accommodation/
├── modules.txt                                  → "Accommodation"
├── doctype/
│   ├── accommodation/                           Master: camp / villa / apartment
│   ├── accommodation_room_setup/                Child table — bulk room generator
│   ├── accommodation_room/                      Rooms inside a property
│   ├── accommodation_bed/                       One record per bedspace
│   └── accommodation_allocation/                Submittable — the registration
└── report/
    └── accommodation_occupancy_tracker/         Script Report + chart + summary
```

## Access control

Every DocType and the report are restricted to **System Manager** and **HR Manager**.
No other role has read, write, create, delete, submit or cancel.

## Setup flow

1. **Create Accommodation** — company first; region auto-sets from the company's country.
2. Fill the **Room Setup** table, one row per block/floor:

   | Block | Floor | Room Prefix | From | To | Beds per Room | Room Type |
   |-------|-------|-------------|------|----|---------------|-----------|
   | A     | 1     | A-1         | 1    | 6  | 6             | Bunk      |
   | B     | 1     | B-1         | 1    | 6  | 6             | Bunk      |

3. Press **Generate Rooms** — creates 12 rooms and 72 bedspaces. Re-running is safe;
   existing rooms are skipped, never duplicated.
4. Bedspaces are created automatically on room save, numbered `B1…Bn`,
   alternating Lower / Upper. Raising capacity adds beds. Lowering it removes only
   free beds — occupied or reserved beds are kept and a warning is shown.

## Bed states

| State | Meaning |
|-------|---------|
| **Available** | Free to allocate |
| **Occupied** | Active allocation |
| **Reserved** | Held for an incoming joiner, with expected arrival date |
| **Blocked** | Maintenance — excluded from availability |

Bed status is **never set by hand in normal use**. It is derived from the Allocation
document, which keeps the grid and reality in step. The field stays editable for
corrections, per standing policy.

## Allocation lifecycle

| Action | Effect |
|--------|--------|
| Submit, type = **Check-In** | status → Active, bed → Occupied |
| Submit, type = **Reservation** | status → Reserved, bed → Reserved, arrival date carried to the bed |
| **Check In** button (on a reservation) | status → Active, bed → Occupied |
| **Vacate** button | sets actual check-out, computes duration, status → Vacated, bed → Available. History preserved. |
| Cancel | status → Cancelled, bed released. Use only for genuine errors. |

### Validations

- Bed must belong to the selected room; room must belong to the selected accommodation.
- Bed must be Available — blocked, occupied and reserved beds are rejected.
- One open (Reserved or Active) allocation per employee.
- Check-in cannot precede the employee's date of joining.
- Actual check-out cannot precede check-in.
- Reservation requires an expected arrival date.
- The **Bed** link field only lists Available beds in the chosen room.

## Cross-entity stays

A UAE-visa worker deployed to a KSA camp is normal and is **not blocked**.

- `employee_company` — the visa entity, fetched from Employee.
- `accommodation_company` — the owner of the bed, fetched from Accommodation.
- `is_cross_entity` — auto-ticked when they differ; a banner appears on the form.

The tracker reports these separately so bed-days can be recharged between entities.

## Occupancy Tracker report

Filters: Company · Region · Accommodation · Bed Status.

Summary bar: Accommodations · Rooms · Total Beds · Occupied · Reserved ·
**Available** · Blocked · Occupancy %. Available excludes reserved beds, so the
figure is genuinely free capacity.

Chart: stacked occupied vs available per property. Status column is colour-coded.

## Before installing — one check

A module named **Accommodation** existed previously and was removed as orphaned
during the v15 migration. Confirm no stale `Module Def` or `tabAccommodation*`
tables remain, or the install will collide:

```sql
select name, app_name from `tabModule Def` where name = 'Accommodation'
```

If a row exists and belongs to a different app, resolve it before proceeding.

## Deployment notes

- Python import paths in this build assume a standalone app named `accommodation`
  (`accommodation.accommodation.doctype…`). If the module is dropped into an
  existing app instead, every import prefix and the `free_bed_query` path in
  `accommodation_allocation.js` must change to that app's name.
- `Accommodation` must be added to the host app's `modules.txt`.
- No fields are set read-only by default, other than the standard `amended_from`.
- No fixtures, no workspace JSON. Workspace and any print formats are to be created
  through the ERPNext UI.
- Both `main` (v14) and `version-15` branches need the same files.
