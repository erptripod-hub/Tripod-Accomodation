# Copyright (c) 2026, Tripod Group and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import date_diff, getdate, nowdate

from accommodation.accommodation.doctype.accommodation.accommodation import (
	refresh_parent_counts,
)

OPEN_STATES = ("Reserved", "Active")


class AccommodationAllocation(Document):
	def validate(self):
		self.set_defaults()
		self.validate_bed_belongs_to_room()
		self.validate_bed_available()
		self.validate_single_open_allocation()
		self.validate_dates()
		self.set_cross_entity_flag()
		self.set_duration()

	def set_defaults(self):
		if self.allocation_type == "Check-In" and not self.check_in_date:
			self.check_in_date = nowdate()
		if self.docstatus == 0 and self.status in (None, ""):
			self.status = "Draft"

	def validate_bed_belongs_to_room(self):
		bed_room, bed_accommodation = frappe.db.get_value(
			"Accommodation Bed", self.bed, ["room", "accommodation"]
		) or (None, None)
		if bed_room != self.room:
			frappe.throw(_("Bed {0} does not belong to room {1}.").format(self.bed, self.room))
		if bed_accommodation != self.accommodation:
			frappe.throw(
				_("Room {0} does not belong to accommodation {1}.").format(
					self.room, self.accommodation
				)
			)

	def validate_bed_available(self):
		bed = frappe.db.get_value(
			"Accommodation Bed",
			self.bed,
			["status", "current_allocation", "bed_reservation"],
			as_dict=True,
		)
		if not bed:
			frappe.throw(_("Bed {0} does not exist.").format(self.bed))

		if bed.status == "Blocked":
			frappe.throw(_("Bed {0} is blocked for maintenance.").format(self.bed))

		if bed.status == "Occupied" and bed.current_allocation != self.name:
			frappe.throw(
				_("Bed {0} is already occupied. Choose a free bedspace.").format(self.bed)
			)

		if bed.status == "Reserved" and bed.current_allocation != self.name:
			# A bulk hold is a placeholder - allocating a person to it consumes the hold.
			# A hold for a named employee still blocks anyone else.
			if not bed.bed_reservation:
				frappe.throw(
					_("Bed {0} is reserved for another employee. Choose a free bedspace.").format(
						self.bed
					)
				)

	def validate_single_open_allocation(self):
		other = frappe.get_all(
			"Accommodation Allocation",
			filters={
				"employee": self.employee,
				"status": ("in", OPEN_STATES),
				"docstatus": 1,
				"name": ("!=", self.name),
			},
			fields=["name", "bed", "status"],
			limit=1,
		)
		if other:
			frappe.throw(
				_("{0} already has an open allocation ({1}) on bed {2}. Vacate it first.").format(
					self.employee_name or self.employee, other[0].name, other[0].bed
				)
			)

	def validate_dates(self):
		joining = frappe.db.get_value("Employee", self.employee, "date_of_joining")
		if self.check_in_date and joining and getdate(self.check_in_date) < getdate(joining):
			frappe.throw(_("Check-In Date cannot be before the employee's joining date."))

		if self.actual_check_out and self.check_in_date:
			if getdate(self.actual_check_out) < getdate(self.check_in_date):
				frappe.throw(_("Actual Check-Out cannot be before Check-In Date."))

		if self.allocation_type == "Reservation" and not self.expected_arrival_date:
			frappe.throw(_("Expected Arrival is required for a reservation."))

	def set_cross_entity_flag(self):
		self.is_cross_entity = (
			1
			if (
				self.employee_company
				and self.accommodation_company
				and self.employee_company != self.accommodation_company
			)
			else 0
		)

	def set_duration(self):
		start = self.check_in_date
		if not start:
			self.duration_days = 0
			return
		end = self.actual_check_out or nowdate()
		self.duration_days = max(0, date_diff(end, start))

	def on_submit(self):
		if self.allocation_type == "Reservation":
			self.db_set("status", "Reserved")
			self.apply_to_bed("Reserved")
		else:
			self.db_set("status", "Active")
			self.apply_to_bed("Occupied")

	def on_cancel(self):
		self.db_set("status", "Cancelled")
		self.release_bed()

	def consume_bulk_hold(self):
		"""If this bed was held by a bulk reservation, drop it from that hold."""
		reservation = frappe.db.get_value("Accommodation Bed", self.bed, "bed_reservation")
		if not reservation:
			return
		frappe.db.delete(
			"Accommodation Reserved Bed", {"parent": reservation, "bed": self.bed}
		)
		remaining = frappe.db.count("Accommodation Reserved Bed", {"parent": reservation})
		if not remaining:
			frappe.db.set_value(
				"Accommodation Bed Reservation", reservation, "status", "Released",
				update_modified=False,
			)

	def apply_to_bed(self, bed_status):
		self.consume_bulk_hold()
		values = {"status": bed_status, "bed_reservation": None, "reserved_until": None}
		if bed_status == "Occupied":
			values.update(
				{
					"current_employee": self.employee,
					"current_allocation": self.name,
					"reserved_for": None,
					"expected_arrival_date": None,
				}
			)
		else:
			values.update(
				{
					"current_employee": None,
					"current_allocation": self.name,
					"reserved_for": self.employee,
					"expected_arrival_date": self.expected_arrival_date,
				}
			)
		frappe.db.set_value("Accommodation Bed", self.bed, values, update_modified=False)
		refresh_parent_counts(accommodation=self.accommodation, room=self.room)

	def release_bed(self):
		holder = frappe.db.get_value("Accommodation Bed", self.bed, "current_allocation")
		if holder and holder != self.name:
			return
		frappe.db.set_value(
			"Accommodation Bed",
			self.bed,
			{
				"status": "Available",
				"current_employee": None,
				"current_allocation": None,
				"reserved_for": None,
				"expected_arrival_date": None,
				"bed_reservation": None,
				"reserved_until": None,
			},
			update_modified=False,
		)
		refresh_parent_counts(accommodation=self.accommodation, room=self.room)

	# ------------------------------------------------------------------
	# Buttons
	# ------------------------------------------------------------------

	@frappe.whitelist()
	def check_in(self, check_in_date=None):
		"""Convert a live reservation into an active occupancy."""
		if self.docstatus != 1 or self.status != "Reserved":
			frappe.throw(_("Only a submitted reservation can be checked in."))

		self.db_set("allocation_type", "Check-In")
		self.db_set("check_in_date", check_in_date or nowdate())
		self.db_set("status", "Active")
		self.reload()
		self.apply_to_bed("Occupied")
		frappe.msgprint(_("Checked in."), indicator="green", alert=True)
		return self.status

	@frappe.whitelist()
	def vacate(self, actual_check_out=None):
		"""Free the bed and close the allocation, keeping the history."""
		if self.docstatus != 1 or self.status not in OPEN_STATES:
			frappe.throw(_("Only a submitted, open allocation can be vacated."))

		out_date = getdate(actual_check_out or nowdate())
		if self.check_in_date and out_date < getdate(self.check_in_date):
			frappe.throw(_("Actual Check-Out cannot be before Check-In Date."))

		self.db_set("actual_check_out", out_date)
		if self.check_in_date:
			self.db_set("duration_days", max(0, date_diff(out_date, self.check_in_date)))
		self.db_set("status", "Vacated")
		self.release_bed()
		frappe.msgprint(_("Bedspace released."), indicator="green", alert=True)
		return self.status


# ----------------------------------------------------------------------
# Link query filters
# ----------------------------------------------------------------------

@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def free_bed_query(doctype, txt, searchfield, start, page_len, filters):
	"""Show only bedspaces that can actually be allocated."""
	room = (filters or {}).get("room")
	return frappe.db.sql(
		"""
		select name, bed_no, bed_position
		from `tabAccommodation Bed`
		where room = %(room)s
			and status = 'Available'
			and (name like %(txt)s or bed_no like %(txt)s)
		order by bed_no
		limit %(start)s, %(page_len)s
		""",
		{
			"room": room,
			"txt": "%%%s%%" % txt,
			"start": start,
			"page_len": page_len,
		},
	)
