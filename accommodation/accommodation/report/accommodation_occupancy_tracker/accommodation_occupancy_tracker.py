# Copyright (c) 2026, Tripod Group and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import date_diff, nowdate


def execute(filters=None):
	filters = frappe._dict(filters or {})
	columns = get_columns()
	data = get_data(filters)
	report_summary = get_summary(data)
	chart = get_chart(data)
	return columns, data, None, chart, report_summary


def get_columns():
	return [
		{"label": _("Accommodation"), "fieldname": "accommodation", "fieldtype": "Link", "options": "Accommodation", "width": 190},
		{"label": _("Company"), "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 170},
		{"label": _("Room"), "fieldname": "room_no", "fieldtype": "Data", "width": 90},
		{"label": _("Bed"), "fieldname": "bed_no", "fieldtype": "Data", "width": 70},
		{"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 100},
		{"label": _("Employee"), "fieldname": "employee", "fieldtype": "Link", "options": "Employee", "width": 120},
		{"label": _("Employee Name"), "fieldname": "employee_name", "fieldtype": "Data", "width": 170},
		{"label": _("Visa Entity"), "fieldname": "employee_company", "fieldtype": "Link", "options": "Company", "width": 170},
		{"label": _("Cross Entity"), "fieldname": "is_cross_entity", "fieldtype": "Check", "width": 100},
		{"label": _("Check-In"), "fieldname": "check_in_date", "fieldtype": "Date", "width": 100},
		{"label": _("Expected Arrival"), "fieldname": "expected_arrival_date", "fieldtype": "Date", "width": 120},
		{"label": _("Duration (Days)"), "fieldname": "duration_days", "fieldtype": "Int", "width": 120},
		{"label": _("Remark"), "fieldname": "remark", "fieldtype": "Data", "width": 180},
	]


def get_data(filters):
	conditions = []
	values = {}

	for key, field in (
		("company", "bed.company"),
		("accommodation", "bed.accommodation"),
		("status", "bed.status"),
	):
		if filters.get(key):
			conditions.append("{0} = %({1})s".format(field, key))
			values[key] = filters.get(key)

	if filters.get("region"):
		conditions.append("acc.region = %(region)s")
		values["region"] = filters.get("region")

	where = ("where " + " and ".join(conditions)) if conditions else ""

	rows = frappe.db.sql(
		"""
		select
			bed.accommodation, bed.company, bed.status, bed.bed_no, bed.blocked_reason,
			bed.expected_arrival_date, bed.reserved_for,
			room.room_no, room.block,
			alloc.name as allocation, alloc.employee, alloc.employee_name,
			alloc.employee_company, alloc.is_cross_entity, alloc.check_in_date
		from `tabAccommodation Bed` bed
		left join `tabAccommodation Room` room on room.name = bed.room
		left join `tabAccommodation` acc on acc.name = bed.accommodation
		left join `tabAccommodation Allocation` alloc
			on alloc.name = bed.current_allocation and alloc.docstatus = 1
		{where}
		order by bed.accommodation, room.room_no, bed.bed_no
		""".format(where=where),
		values,
		as_dict=True,
	)

	today = nowdate()
	for row in rows:
		row["duration_days"] = (
			max(0, date_diff(today, row.check_in_date)) if row.get("check_in_date") else 0
		)
		if row.status == "Blocked":
			row["remark"] = row.get("blocked_reason") or _("Blocked")
		elif row.status == "Reserved":
			reserved_name = (
				frappe.db.get_value("Employee", row.reserved_for, "employee_name")
				if row.get("reserved_for")
				else None
			)
			row["employee_name"] = row.get("employee_name") or reserved_name
			row["remark"] = _("Awaiting arrival")
		elif row.status == "Available":
			row["remark"] = _("Free to allocate")
		else:
			row["remark"] = _("Cross-entity stay") if row.get("is_cross_entity") else ""

	return rows


def get_summary(data):
	total = len(data)
	occupied = len([d for d in data if d.status == "Occupied"])
	reserved = len([d for d in data if d.status == "Reserved"])
	available = len([d for d in data if d.status == "Available"])
	blocked = len([d for d in data if d.status == "Blocked"])
	accommodations = len(set(d.accommodation for d in data if d.accommodation))
	rooms = len(set((d.accommodation, d.room_no) for d in data if d.room_no))
	pct = round((occupied / total) * 100, 1) if total else 0

	return [
		{"label": _("Accommodations"), "value": accommodations, "datatype": "Int"},
		{"label": _("Rooms"), "value": rooms, "datatype": "Int"},
		{"label": _("Total Beds"), "value": total, "datatype": "Int"},
		{"label": _("Occupied"), "value": occupied, "datatype": "Int", "indicator": "Red"},
		{"label": _("Reserved"), "value": reserved, "datatype": "Int", "indicator": "Orange"},
		{"label": _("Available"), "value": available, "datatype": "Int", "indicator": "Green"},
		{"label": _("Blocked"), "value": blocked, "datatype": "Int", "indicator": "Grey"},
		{"label": _("Occupancy %"), "value": pct, "datatype": "Percent"},
	]


def get_chart(data):
	labels, occupied, available = [], [], []
	grouped = {}
	for row in data:
		key = row.accommodation or _("Unassigned")
		grouped.setdefault(key, {"o": 0, "v": 0})
		if row.status == "Occupied":
			grouped[key]["o"] += 1
		elif row.status == "Available":
			grouped[key]["v"] += 1

	for key in sorted(grouped):
		labels.append(key)
		occupied.append(grouped[key]["o"])
		available.append(grouped[key]["v"])

	return {
		"data": {
			"labels": labels,
			"datasets": [
				{"name": _("Occupied"), "values": occupied},
				{"name": _("Available"), "values": available},
			],
		},
		"type": "bar",
		"barOptions": {"stacked": 1},
		"colors": ["#B0492E", "#0F6E56"],
	}
