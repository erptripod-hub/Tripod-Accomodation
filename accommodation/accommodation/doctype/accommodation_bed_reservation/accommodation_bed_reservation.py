# Copyright (c) 2026, Tripod Group and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, nowdate

OPEN_STATUS = ("Active",)


class AccommodationBedReservation(Document):
	def validate(self):
		self.validate_dates()
		self.validate_beds()
		if self.docstatus == 0 and not self.status:
			self.status = "Draft"

	def validate_dates(self):
		if getdate(self.reserved_until) < getdate(self.reserved_from):
			frappe.throw(_("Reserved Until cannot be before Reserved From."))

	def validate_beds(self):
		if not self.beds:
			return

		seen = set()
		for row in self.beds:
			if row.bed in seen:
				frappe.throw(_("Bed {0} is listed more than once.").format(row.bed))
			seen.add(row.bed)

			bed = frappe.db.get_value(
				"Accommodation Bed",
				row.bed,
				["status", "accommodation", "bed_reservation"],
				as_dict=True,
			)
			if not bed:
				frappe.throw(_("Bed {0} does not exist.").format(row.bed))

			if bed.accommodation != self.accommodation:
				frappe.throw(
					_("Bed {0} does not belong to {1}.").format(row.bed, self.accommodation)
				)

			# A bed already held by this same reservation is fine.
			if bed.bed_reservation and bed.bed_reservation != self.name:
				frappe.throw(
					_("Bed {0} is already held by reservation {1}.").format(
						row.bed, bed.bed_reservation
					)
				)

			if bed.status in ("Occupied",):
				frappe.throw(_("Bed {0} is occupied.").format(row.bed))

			if bed.status == "Blocked":
				frappe.throw(_("Bed {0} is blocked for maintenance.").format(row.bed))

			if bed.status == "Reserved" and not bed.bed_reservation:
				frappe.throw(
					_("Bed {0} is reserved for a named employee. Choose another bed.").format(row.bed)
				)

	def on_submit(self):
		if not self.beds:
			frappe.throw(_("Add at least one bedspace before submitting."))
		self.db_set("status", "Active")
		self.hold_beds()

	def on_cancel(self):
		self.db_set("status", "Cancelled")
		self.free_beds()

	def hold_beds(self):
		from accommodation.accommodation.doctype.accommodation.accommodation import (
			refresh_parent_counts,
		)

		rooms = set()
		for row in self.beds:
			frappe.db.set_value(
				"Accommodation Bed",
				row.bed,
				{
					"status": "Reserved",
					"bed_reservation": self.name,
					"reserved_until": self.reserved_until,
					"current_employee": None,
					"reserved_for": None,
					"expected_arrival_date": self.reserved_from,
				},
				update_modified=False,
			)
			rooms.add(frappe.db.get_value("Accommodation Bed", row.bed, "room"))

		for room in rooms:
			refresh_parent_counts(accommodation=self.accommodation, room=room)

	def free_beds(self):
		from accommodation.accommodation.doctype.accommodation.accommodation import (
			refresh_parent_counts,
		)

		rooms = set()
		for row in self.beds:
			held_by = frappe.db.get_value("Accommodation Bed", row.bed, "bed_reservation")
			if held_by != self.name:
				continue
			frappe.db.set_value(
				"Accommodation Bed",
				row.bed,
				{
					"status": "Available",
					"bed_reservation": None,
					"reserved_until": None,
					"reserved_for": None,
					"expected_arrival_date": None,
					"current_employee": None,
					"current_allocation": None,
				},
				update_modified=False,
			)
			rooms.add(frappe.db.get_value("Accommodation Bed", row.bed, "room"))

		for room in rooms:
			refresh_parent_counts(accommodation=self.accommodation, room=room)

	# ------------------------------------------------------------------
	# Buttons
	# ------------------------------------------------------------------

	@frappe.whitelist()
	def fetch_available_beds(self):
		"""Fill the table with free bedspaces, up to headcount."""
		existing = {row.bed for row in self.beds}
		wanted = (self.headcount or 0) - len(existing)
		if wanted <= 0:
			frappe.msgprint(
				_("The table already holds {0} bedspace(s).").format(len(existing)),
				indicator="orange",
				alert=True,
			)
			return 0

		filters = {"accommodation": self.accommodation, "status": "Available"}
		if self.room:
			filters["room"] = self.room

		free = frappe.get_all(
			"Accommodation Bed",
			filters=filters,
			fields=["name", "room", "bed_no", "bed_position"],
			order_by="room, bed_no",
			limit=wanted + len(existing),
		)

		added = 0
		for bed in free:
			if bed.name in existing:
				continue
			if added >= wanted:
				break
			self.append("beds", {"bed": bed.name, "room": bed.room})
			added += 1

		if added < wanted:
			frappe.msgprint(
				_("Only {0} free bedspace(s) found. Requested {1}.").format(added, wanted),
				indicator="orange",
			)
		else:
			frappe.msgprint(
				_("{0} bedspace(s) added.").format(added), indicator="green", alert=True
			)

		self.save()
		return added

	@frappe.whitelist()
	def release(self):
		"""Free every held bed without cancelling the document."""
		if self.docstatus != 1 or self.status not in OPEN_STATUS:
			frappe.throw(_("Only an active reservation can be released."))
		self.free_beds()
		self.db_set("status", "Released")
		frappe.msgprint(_("Bedspaces released."), indicator="green", alert=True)
		return self.status

	def consume_bed(self, bed):
		"""Drop one bed from the hold when it gets allocated to a person."""
		remaining = [row.bed for row in self.beds if row.bed != bed]
		if not remaining:
			self.db_set("status", "Released")


def expire_reservations():
	"""Daily: release holds whose end date has passed."""
	stale = frappe.get_all(
		"Accommodation Bed Reservation",
		filters={"docstatus": 1, "status": "Active", "reserved_until": ("<", nowdate())},
		pluck="name",
	)
	for name in stale:
		doc = frappe.get_doc("Accommodation Bed Reservation", name)
		doc.free_beds()
		doc.db_set("status", "Expired")
	if stale:
		frappe.db.commit()
	return len(stale)
