// Copyright (c) 2026, Tripod Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("Accommodation Bed Reservation", {
	setup(frm) {
		frm.set_query("room", () => {
			return { filters: { accommodation: frm.doc.accommodation } };
		});

		frm.set_query("bed", "beds", () => {
			const filters = { accommodation: frm.doc.accommodation, status: "Available" };
			if (frm.doc.room) filters.room = frm.doc.room;
			return { filters: filters };
		});
	},

	refresh(frm) {
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button(__("Fetch Available Beds"), () => {
				if (!frm.doc.accommodation) {
					frappe.msgprint(__("Select an Accommodation first."));
					return;
				}
				frm.call({
					doc: frm.doc,
					method: "fetch_available_beds",
					freeze: true,
					freeze_message: __("Finding free bedspaces..."),
					callback: () => frm.reload_doc(),
				});
			}).addClass("btn-primary");
		}

		if (frm.doc.docstatus === 1 && frm.doc.status === "Active") {
			frm.add_custom_button(__("Release Beds"), () => {
				frappe.confirm(
					__("Release all {0} held bedspace(s)?", [(frm.doc.beds || []).length]),
					() => {
						frm.call({ doc: frm.doc, method: "release", freeze: true }).then(() =>
							frm.reload_doc()
						);
					}
				);
			});
		}

		if (!frm.is_new()) {
			frm.add_custom_button(__("Occupancy Tracker"), () => {
				frappe.set_route("accommodation-tracker");
			});
		}

		set_indicator(frm);
	},

	accommodation(frm) {
		frm.set_value("room", null);
		frm.clear_table("beds");
		frm.refresh_field("beds");
	},

	room(frm) {
		frm.clear_table("beds");
		frm.refresh_field("beds");
	},
});

function set_indicator(frm) {
	const map = {
		Active: "orange",
		Released: "green",
		Expired: "grey",
		Cancelled: "red",
		Draft: "blue",
	};
	if (frm.doc.status && map[frm.doc.status]) {
		frm.page.set_indicator(__(frm.doc.status), map[frm.doc.status]);
	}
}
