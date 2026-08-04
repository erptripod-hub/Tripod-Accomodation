# Copyright (c) 2026, Tripod Group and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from accommodation.accommodation.doctype.accommodation.accommodation import (
	refresh_parent_counts,
)

POSITIONS = ["Lower", "Upper"]


class AccommodationRoom(Document):
	def validate(self):
		if not self.capacity or self.capacity < 1:
			frappe.throw(_("Capacity must be at least 1."))
		self.validate_unique_room_no()

	def validate_unique_room_no(self):
		duplicate = frappe.db.exists(
			"Accommodation Room",
			{
				"accommodation": self.accommodation,
				"room_no": self.room_no,
				"name": ("!=", self.name),
			},
		)
		if duplicate:
			frappe.throw(
				_("Room {0} already exists in {1}.").format(self.room_no, self.accommodation)
			)

	def after_insert(self):
		self.sync_beds()

	def on_update(self):
		self.sync_beds()

	def on_trash(self):
		occupied = frappe.get_all(
			"Accommodation Bed",
			filters={"room": self.name, "status": ("in", ["Occupied", "Reserved"])},
			pluck="name",
		)
		if occupied:
			frappe.throw(
				_("Cannot delete: {0} bedspace(s) are occupied or reserved.").format(len(occupied))
			)
		for bed in frappe.get_all("Accommodation Bed", filters={"room": self.name}, pluck="name"):
			frappe.delete_doc("Accommodation Bed", bed, ignore_permissions=True, force=True)
		refresh_parent_counts(accommodation=self.accommodation)

	def sync_beds(self):
		"""Create missing bedspaces, and remove surplus ones only if free."""
		existing = frappe.get_all(
			"Accommodation Bed",
			filters={"room": self.name},
			fields=["name", "bed_no", "status"],
			order_by="bed_no",
		)
		existing_nos = [b.bed_no for b in existing]

		for i in range(1, (self.capacity or 0) + 1):
			bed_no = "B{0}".format(i)
			if bed_no in existing_nos:
				continue
			doc = frappe.new_doc("Accommodation Bed")
			doc.room = self.name
			doc.bed_no = bed_no
			doc.bed_position = POSITIONS[(i - 1) % 2] if (self.capacity or 0) > 1 else "Single"
			doc.status = "Available"
			doc.insert(ignore_permissions=True)

		# Trim surplus beds beyond capacity, but never an occupied or reserved one.
		for bed in existing:
			try:
				index = int(bed.bed_no.replace("B", ""))
			except ValueError:
				continue
			if index > (self.capacity or 0):
				if bed.status in ("Occupied", "Reserved"):
					frappe.msgprint(
						_("Bed {0} is {1} and was not removed. Vacate it first.").format(
							bed.bed_no, bed.status
						),
						indicator="orange",
						alert=True,
					)
					continue
				frappe.delete_doc("Accommodation Bed", bed.name, ignore_permissions=True, force=True)

		refresh_parent_counts(accommodation=self.accommodation, room=self.name)
