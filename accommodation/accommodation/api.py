# Copyright (c) 2026, Tripod Group and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import date_diff, getdate, nowdate

ALLOWED_ROLES = ("System Manager", "HR Manager")
STATUSES = ("Occupied", "Reserved", "Available", "Blocked")


def check_access():
	roles = set(frappe.get_roles())
	if not roles.intersection(ALLOWED_ROLES):
		frappe.throw(_("Not permitted."), frappe.PermissionError)


def blank_tally():
	return {"total": 0, "Occupied": 0, "Reserved": 0, "Available": 0, "Blocked": 0}


def add_pct(t):
	t["pct"] = round((t["Occupied"] / t["total"]) * 100, 1) if t["total"] else 0
	return t


@frappe.whitelist()
def get_overview(company=None):
	"""Property cards plus group totals."""
	check_access()

	filters = {"status": "Active"}
	if company:
		filters["company"] = company

	accs = frappe.get_all(
		"Accommodation",
		filters=filters,
		fields=[
			"name", "accommodation_name", "company", "region", "accommodation_type",
			"city", "image", "contract_end_date", "permit_expiry",
		],
		order_by="accommodation_name",
	)

	bed_filters = {}
	if company:
		bed_filters["company"] = company

	rows = frappe.get_all(
		"Accommodation Bed",
		filters=bed_filters,
		fields=["accommodation", "status", "count(name) as qty"],
		group_by="accommodation, status",
	)

	by_acc = {}
	for r in rows:
		by_acc.setdefault(r.accommodation, blank_tally())
		if r.status in STATUSES:
			by_acc[r.accommodation][r.status] = r.qty
		by_acc[r.accommodation]["total"] += r.qty

	room_rows = frappe.get_all(
		"Accommodation Room",
		filters=bed_filters,
		fields=["accommodation", "count(name) as qty"],
		group_by="accommodation",
	)
	rooms_by_acc = {r.accommodation: r.qty for r in room_rows}

	grand = blank_tally()
	for a in accs:
		t = add_pct(by_acc.get(a.name, blank_tally()))
		a["tally"] = t
		a["rooms"] = rooms_by_acc.get(a.name, 0)
		for k in STATUSES:
			grand[k] += t[k]
		grand["total"] += t["total"]

	add_pct(grand)

	return {
		"accommodations": accs,
		"totals": grand,
		"rooms": sum(rooms_by_acc.get(a.name, 0) for a in accs),
		"companies": frappe.get_all("Company", fields=["name"], order_by="name"),
		"alerts": get_alerts(company, grand),
	}


def get_alerts(company, grand):
	alerts = []
	if grand["Reserved"]:
		alerts.append(_("{0} beds reserved for incoming arrivals").format(grand["Reserved"]))

	unallocated = count_unallocated(company)
	if unallocated:
		alerts.append(_("{0} employees without a bedspace").format(unallocated))

	filters = {"status": "Active", "contract_end_date": ("<=", frappe.utils.add_days(nowdate(), 90))}
	if company:
		filters["company"] = company
	expiring = frappe.db.count("Accommodation", filters)
	if expiring:
		alerts.append(_("{0} tenancy contract(s) expiring within 90 days").format(expiring))

	return alerts


def count_unallocated(company=None):
	conditions = "e.status = 'Active'"
	values = {}
	if company:
		conditions += " and e.company = %(company)s"
		values["company"] = company

	return frappe.db.sql(
		"""
		select count(e.name)
		from `tabEmployee` e
		where {conditions}
			and not exists (
				select 1 from `tabAccommodation Allocation` a
				where a.employee = e.name and a.docstatus = 1
					and a.status in ('Active', 'Reserved')
			)
		""".format(conditions=conditions),
		values,
	)[0][0]


@frappe.whitelist()
def get_accommodation(accommodation):
	"""Detail panel plus room tiles."""
	check_access()

	doc = frappe.get_doc("Accommodation", accommodation)
	doc.check_permission("read")

	rooms = frappe.get_all(
		"Accommodation Room",
		filters={"accommodation": accommodation},
		fields=["name", "room_no", "block", "floor", "room_type", "capacity"],
		order_by="room_no",
	)

	rows = frappe.get_all(
		"Accommodation Bed",
		filters={"accommodation": accommodation},
		fields=["room", "status", "count(name) as qty"],
		group_by="room, status",
	)
	by_room = {}
	for r in rows:
		by_room.setdefault(r.room, blank_tally())
		if r.status in STATUSES:
			by_room[r.room][r.status] = r.qty
		by_room[r.room]["total"] += r.qty

	beds = frappe.get_all(
		"Accommodation Bed",
		filters={"accommodation": accommodation},
		fields=["name", "room", "bed_no", "status"],
		order_by="room, bed_no",
	)
	strips = {}
	for b in beds:
		strips.setdefault(b.room, []).append(b.status)

	total = blank_tally()
	for r in rooms:
		t = add_pct(by_room.get(r.name, blank_tally()))
		r["tally"] = t
		r["strip"] = strips.get(r.name, [])
		for k in STATUSES:
			total[k] += t[k]
		total["total"] += t["total"]
	add_pct(total)

	landlord = frappe.db.get_value("Supplier", doc.landlord, "supplier_name") if doc.landlord else None
	supervisor = frappe.db.get_value("Employee", doc.supervisor, "employee_name") if doc.supervisor else None

	return {
		"doc": {
			"name": doc.name,
			"accommodation_name": doc.accommodation_name,
			"company": doc.company,
			"region": doc.region,
			"accommodation_type": doc.accommodation_type,
			"city": doc.city,
			"address": doc.address,
			"image": doc.image,
			"landlord": landlord,
			"contract_start_date": doc.contract_start_date,
			"contract_end_date": doc.contract_end_date,
			"annual_rent": doc.annual_rent,
			"currency": frappe.db.get_value("Company", doc.company, "default_currency"),
			"permit_no": doc.permit_no,
			"permit_expiry": doc.permit_expiry,
			"supervisor": supervisor,
			"supervisor_id": doc.supervisor,
		},
		"rooms": rooms,
		"totals": total,
	}


@frappe.whitelist()
def get_room(room):
	"""Bedspace tiles for one room."""
	check_access()

	room_doc = frappe.get_doc("Accommodation Room", room)
	room_doc.check_permission("read")

	beds = frappe.get_all(
		"Accommodation Bed",
		filters={"room": room},
		fields=[
			"name", "bed_no", "bed_position", "status", "blocked_reason",
			"current_employee", "current_allocation", "reserved_for", "expected_arrival_date",
		],
		order_by="bed_no",
	)

	acc_company = frappe.db.get_value("Accommodation", room_doc.accommodation, "company")

	for b in beds:
		emp = b.current_employee or b.reserved_for
		b["employee_name"] = None
		b["designation"] = None
		b["employee_company"] = None
		b["check_in_date"] = None
		b["duration_days"] = 0
		b["is_cross_entity"] = 0

		if emp:
			info = frappe.db.get_value(
				"Employee", emp, ["employee_name", "designation", "company"], as_dict=True
			)
			if info:
				b["employee_name"] = info.employee_name
				b["designation"] = info.designation
				b["employee_company"] = info.company
				b["is_cross_entity"] = 1 if info.company != acc_company else 0

		if b.current_allocation:
			alloc = frappe.db.get_value(
				"Accommodation Allocation", b.current_allocation,
				["check_in_date", "is_cross_entity"], as_dict=True
			)
			if alloc:
				b["check_in_date"] = alloc.check_in_date
				b["is_cross_entity"] = alloc.is_cross_entity
				if alloc.check_in_date:
					b["duration_days"] = max(0, date_diff(nowdate(), alloc.check_in_date))

	return {
		"room": {
			"name": room_doc.name,
			"room_no": room_doc.room_no,
			"block": room_doc.block,
			"floor": room_doc.floor,
			"room_type": room_doc.room_type,
			"capacity": room_doc.capacity,
			"accommodation": room_doc.accommodation,
			"accommodation_name": frappe.db.get_value(
				"Accommodation", room_doc.accommodation, "accommodation_name"
			),
			"company": acc_company,
		},
		"beds": beds,
		"totals": add_pct(count_from_beds(beds)),
	}


def count_from_beds(beds):
	t = blank_tally()
	for b in beds:
		if b["status"] in STATUSES:
			t[b["status"]] += 1
		t["total"] += 1
	return t


@frappe.whitelist()
def get_free_employees(company=None, txt=None, limit=50):
	"""Employees with no open allocation."""
	check_access()

	conditions = "e.status = 'Active'"
	values = {"limit": int(limit)}
	if company:
		conditions += " and e.company = %(company)s"
		values["company"] = company
	if txt:
		conditions += " and (e.name like %(txt)s or e.employee_name like %(txt)s)"
		values["txt"] = "%%%s%%" % txt

	return frappe.db.sql(
		"""
		select e.name, e.employee_name, e.designation, e.company, e.date_of_joining
		from `tabEmployee` e
		where {conditions}
			and not exists (
				select 1 from `tabAccommodation Allocation` a
				where a.employee = e.name and a.docstatus = 1
					and a.status in ('Active', 'Reserved')
			)
		order by e.employee_name
		limit %(limit)s
		""".format(conditions=conditions),
		values,
		as_dict=True,
	)


@frappe.whitelist()
def allocate_bed(bed, employee, date, allocation_type="Check-In", stay_type="Permanent", remarks=None):
	"""Create and submit an allocation against a free bedspace."""
	check_access()

	bed_doc = frappe.get_doc("Accommodation Bed", bed)
	if bed_doc.status != "Available":
		frappe.throw(_("Bed {0} is {1}.").format(bed_doc.bed_no, bed_doc.status.lower()))

	doc = frappe.new_doc("Accommodation Allocation")
	doc.employee = employee
	doc.accommodation = bed_doc.accommodation
	doc.room = bed_doc.room
	doc.bed = bed_doc.name
	doc.allocation_type = allocation_type
	doc.stay_type = stay_type
	doc.remarks = remarks

	if allocation_type == "Reservation":
		doc.expected_arrival_date = getdate(date)
	else:
		doc.check_in_date = getdate(date)

	doc.insert()
	doc.submit()
	return {"allocation": doc.name, "status": doc.status}


@frappe.whitelist()
def vacate_bed(bed, date=None):
	check_access()
	allocation = frappe.db.get_value("Accommodation Bed", bed, "current_allocation")
	if not allocation:
		frappe.throw(_("This bedspace has no active allocation."))
	doc = frappe.get_doc("Accommodation Allocation", allocation)
	doc.vacate(actual_check_out=date or nowdate())
	return {"status": doc.status}


@frappe.whitelist()
def check_in_bed(bed, date=None):
	check_access()
	allocation = frappe.db.get_value("Accommodation Bed", bed, "current_allocation")
	if not allocation:
		frappe.throw(_("This bedspace has no reservation."))
	doc = frappe.get_doc("Accommodation Allocation", allocation)
	doc.check_in(check_in_date=date or nowdate())
	return {"status": doc.status}


@frappe.whitelist()
def release_reservation(bed):
	check_access()
	allocation = frappe.db.get_value("Accommodation Bed", bed, "current_allocation")
	if not allocation:
		frappe.throw(_("This bedspace has no reservation."))
	doc = frappe.get_doc("Accommodation Allocation", allocation)
	doc.cancel()
	return {"status": "Cancelled"}


@frappe.whitelist()
def set_block(bed, blocked, reason=None):
	check_access()
	doc = frappe.get_doc("Accommodation Bed", bed)
	blocked = int(blocked)

	if blocked:
		if doc.status in ("Occupied", "Reserved"):
			frappe.throw(_("Vacate the bedspace before blocking it."))
		doc.status = "Blocked"
		doc.blocked_reason = reason
	else:
		if doc.status != "Blocked":
			frappe.throw(_("This bedspace is not blocked."))
		doc.status = "Available"
		doc.blocked_reason = None

	doc.save()
	return {"status": doc.status}


@frappe.whitelist()
def get_tracker(company=None):
	"""Live tracker tab: reservations due, cross-entity stays, recent movements."""
	check_access()

	acc_filter = {"company": company} if company else {}

	reserved = frappe.db.sql(
		"""
		select bed.name as bed, bed.bed_no, bed.expected_arrival_date,
			room.room_no, acc.accommodation_name, acc.name as accommodation,
			emp.name as employee, emp.employee_name, emp.designation, emp.company
		from `tabAccommodation Bed` bed
		left join `tabAccommodation Room` room on room.name = bed.room
		left join `tabAccommodation` acc on acc.name = bed.accommodation
		left join `tabEmployee` emp on emp.name = bed.reserved_for
		where bed.status = 'Reserved' {cond}
		order by bed.expected_arrival_date
		""".format(cond="and bed.company = %(company)s" if company else ""),
		{"company": company},
		as_dict=True,
	)

	for r in reserved:
		r["days_left"] = date_diff(r.expected_arrival_date, nowdate()) if r.expected_arrival_date else None

	cross = frappe.db.sql(
		"""
		select a.name, a.employee, a.employee_name, a.employee_company,
			a.accommodation_company, a.check_in_date, a.duration_days,
			acc.accommodation_name, room.room_no, bed.bed_no
		from `tabAccommodation Allocation` a
		left join `tabAccommodation` acc on acc.name = a.accommodation
		left join `tabAccommodation Room` room on room.name = a.room
		left join `tabAccommodation Bed` bed on bed.name = a.bed
		where a.docstatus = 1 and a.status = 'Active' and a.is_cross_entity = 1 {cond}
		order by a.check_in_date
		""".format(cond="and a.accommodation_company = %(company)s" if company else ""),
		{"company": company},
		as_dict=True,
	)

	for c in cross:
		if c.check_in_date:
			c["duration_days"] = max(0, date_diff(nowdate(), c.check_in_date))

	movements = frappe.get_all(
		"Accommodation Allocation",
		filters={"docstatus": 1},
		fields=[
			"name", "employee_name", "status", "allocation_type", "accommodation",
			"room", "bed", "check_in_date", "actual_check_out", "modified",
		],
		order_by="modified desc",
		limit=12,
	)

	for m in movements:
		m["accommodation_name"] = frappe.db.get_value(
			"Accommodation", m.accommodation, "accommodation_name"
		)
		m["room_no"] = frappe.db.get_value("Accommodation Room", m.room, "room_no")
		m["bed_no"] = frappe.db.get_value("Accommodation Bed", m.bed, "bed_no")

	by_property = []
	acc_list = frappe.get_all(
		"Accommodation",
		filters=dict(acc_filter, status="Active"),
		fields=["name", "accommodation_name", "company", "region"],
		order_by="accommodation_name",
	)
	for a in acc_list:
		rows = frappe.get_all(
			"Accommodation Bed",
			filters={"accommodation": a.name},
			fields=["status", "count(name) as qty"],
			group_by="status",
		)
		t = blank_tally()
		for r in rows:
			if r.status in STATUSES:
				t[r.status] = r.qty
			t["total"] += r.qty
		a["tally"] = add_pct(t)
		a["rooms"] = frappe.db.count("Accommodation Room", {"accommodation": a.name})
		by_property.append(a)

	return {
		"by_property": by_property,
		"reserved": reserved,
		"cross_entity": cross,
		"movements": movements,
		"unallocated": count_unallocated(company),
	}
