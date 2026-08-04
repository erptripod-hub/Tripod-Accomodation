# Copyright (c) 2026, Tripod Group and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from accommodation.accommodation.doctype.accommodation.accommodation import (
	refresh_parent_counts,
)


class AccommodationBed(Document):
	def validate(self):
		self.clear_stale_links()

	def clear_stale_links(self):
		if self.status == "Available":
			self.current_employee = None
			self.current_allocation = None
			self.reserved_for = None
			self.expected_arrival_date = None
			self.blocked_reason = None
		elif self.status == "Blocked":
			self.current_employee = None
			self.current_allocation = None
			self.reserved_for = None
			self.expected_arrival_date = None
		elif self.status == "Reserved":
			self.current_employee = None
			self.blocked_reason = None
		elif self.status == "Occupied":
			self.reserved_for = None
			self.expected_arrival_date = None
			self.blocked_reason = None

	def on_update(self):
		refresh_parent_counts(accommodation=self.accommodation, room=self.room)

	def on_trash(self):
		if self.status in ("Occupied", "Reserved"):
			frappe.throw(_("Cannot delete a bedspace that is {0}.").format(self.status))
		refresh_parent_counts(accommodation=self.accommodation, room=self.room)
