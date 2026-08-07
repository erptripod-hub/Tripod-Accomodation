app_name = "accommodation"
app_title = "Accommodation"
app_publisher = "Tripod Group"
app_description = "Bedspace-level accommodation management for Tripod Group"
app_email = "it@tripodgroup.com"
app_license = "MIT"
required_apps = ["frappe/erpnext", "frappe/hrms"]

# ------------------------------------------------------------------
# Daily job releases bulk bed holds whose end date has passed, so a
# forgotten reservation never keeps beds out of circulation.
# ------------------------------------------------------------------
scheduler_events = {
	"daily": [
		"accommodation.accommodation.doctype.accommodation_bed_reservation.accommodation_bed_reservation.expire_reservations"
	]
}

# ------------------------------------------------------------------
# Nothing else is registered on purpose.
#
# No fixtures      - roles and permissions ship inside the DocType JSON.
# No workspaces    - created through the ERPNext UI.
# No print formats - pasted through the ERPNext UI.
# No overrides, no doc_events.
# ------------------------------------------------------------------
