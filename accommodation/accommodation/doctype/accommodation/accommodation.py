# Copyright (c) 2026, Tripod Group and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class Accommodation(Document):
	def validate(self):
		self.validate_setup_rows()
		self.update_counts()

	def on_update(self):
		self.update_counts(save=False)

	def validate_setup_rows(self):
		for row in self.room_setup:
			if row.from_number and row.to_number and row.to_number < row.from_number:
				frappe.throw(_("Row {0}: 'To' cannot be less than 'From'.").format(row.idx))
			if row.capacity is not None and row.capacity < 1:
				frappe.throw(_("Row {0}: Beds per Room must be at least 1.").format(row.idx))

	def update_counts(self, save=True):
		counts = get_bed_counts({"accommodation": self.name})
		self.total_rooms = frappe.db.count("Accommodation Room", {"accommodation": self.name})
		self.total_beds = counts["total"]
		self.occupied_beds = counts["Occupied"]
		self.reserved_beds = counts["Reserved"]
		self.available_beds = counts["Available"]
		self.blocked_beds = counts["Blocked"]

	@frappe.whitelist()
	def generate_rooms(self):
		"""Create Accommodation Room records from the Room Setup table."""
		if not self.room_setup:
			frappe.throw(_("Add at least one row in Room Setup first."))

		created, skipped = 0, 0
		for row in self.room_setup:
			prefix = (row.room_prefix or "").strip()
			if not prefix:
				frappe.throw(_("Row {0}: Room Prefix is required.").format(row.idx))

			start = row.from_number or 1
			end = row.to_number or start

			for n in range(start, end + 1):
				room_no = "{0}{1:02d}".format(prefix, n)
				exists = frappe.db.exists(
					"Accommodation Room",
					{"accommodation": self.name, "room_no": room_no},
				)
				if exists:
					skipped += 1
					continue

				doc = frappe.new_doc("Accommodation Room")
				doc.accommodation = self.name
				doc.room_no = room_no
				doc.block = row.block
				doc.floor = row.floor
				doc.room_type = row.room_type or "Bunk"
				doc.capacity = row.capacity or 6
				doc.insert(ignore_permissions=True)
				created += 1

		self.reload()
		self.update_counts()
		self.db_update()

		frappe.msgprint(
			_("{0} room(s) created, {1} already existed.").format(created, skipped),
			indicator="green",
			alert=True,
		)
		return {"created": created, "skipped": skipped}


def get_bed_counts(filters):
	"""Return a dict of bed counts by status for the given filters."""
	result = {"total": 0, "Occupied": 0, "Reserved": 0, "Available": 0, "Blocked": 0}
	rows = frappe.get_all(
		"Accommodation Bed",
		filters=filters,
		fields=["status", "count(name) as qty"],
		group_by="status",
	)
	for row in rows:
		if row.status in result:
			result[row.status] = row.qty
		result["total"] += row.qty
	return result


def refresh_parent_counts(accommodation=None, room=None):
	"""Recalculate cached counts on Room and Accommodation."""
	if room:
		counts = get_bed_counts({"room": room})
		frappe.db.set_value(
			"Accommodation Room",
			room,
			{
				"occupied_beds": counts["Occupied"],
				"reserved_beds": counts["Reserved"],
				"available_beds": counts["Available"],
				"blocked_beds": counts["Blocked"],
			},
			update_modified=False,
		)
		if not accommodation:
			accommodation = frappe.db.get_value("Accommodation Room", room, "accommodation")

	if accommodation:
		counts = get_bed_counts({"accommodation": accommodation})
		frappe.db.set_value(
			"Accommodation",
			accommodation,
			{
				"total_rooms": frappe.db.count("Accommodation Room", {"accommodation": accommodation}),
				"total_beds": counts["total"],
				"occupied_beds": counts["Occupied"],
				"reserved_beds": counts["Reserved"],
				"available_beds": counts["Available"],
				"blocked_beds": counts["Blocked"],
			},
			update_modified=False,
		)
