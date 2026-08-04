// Copyright (c) 2026, Tripod Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("Accommodation Allocation", {
	setup(frm) {
		frm.set_query("room", () => {
			return { filters: { accommodation: frm.doc.accommodation } };
		});

		frm.set_query("bed", () => {
			return {
				query: "accommodation.accommodation.doctype.accommodation_allocation.accommodation_allocation.free_bed_query",
				filters: { room: frm.doc.room },
			};
		});

		frm.set_query("employee", () => {
			return { filters: { status: "Active" } };
		});
	},

	refresh(frm) {
		if (frm.doc.docstatus === 1 && frm.doc.status === "Reserved") {
			frm.add_custom_button(__("Check In"), () => prompt_date(frm, "check_in", __("Check-In Date"), __("Check In")))
				.addClass("btn-primary");
		}

		if (frm.doc.docstatus === 1 && ["Reserved", "Active"].includes(frm.doc.status)) {
			frm.add_custom_button(__("Vacate"), () => prompt_date(frm, "vacate", __("Vacate Date"), __("Vacate")));
		}

		if (frm.doc.is_cross_entity) {
			frm.dashboard.clear_headline();
			frm.dashboard.set_headline(
				__("Cross-entity stay — visa entity {0}, accommodation owned by {1}.", [
					frm.doc.employee_company,
					frm.doc.accommodation_company,
				])
			);
		}
	},

	accommodation(frm) {
		frm.set_value("room", null);
		frm.set_value("bed", null);
	},

	room(frm) {
		frm.set_value("bed", null);
	},

	allocation_type(frm) {
		if (frm.doc.allocation_type === "Check-In" && !frm.doc.check_in_date) {
			frm.set_value("check_in_date", frappe.datetime.get_today());
		}
	},
});

function prompt_date(frm, method, label, action) {
	frappe.prompt(
		[{ fieldname: "d", label: label, fieldtype: "Date", reqd: 1, default: frappe.datetime.get_today() }],
		(values) => {
			const args = method === "vacate" ? { actual_check_out: values.d } : { check_in_date: values.d };
			frm.call({ doc: frm.doc, method: method, args: args, freeze: true })
				.then(() => frm.reload_doc());
		},
		action,
		action
	);
}
