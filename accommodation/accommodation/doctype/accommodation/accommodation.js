// Copyright (c) 2026, Tripod Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("Accommodation", {
	refresh(frm) {
		if (!frm.is_new()) {
			frm.add_custom_button(__("Generate Rooms"), () => {
				frappe.confirm(
					__("Create rooms and bedspaces from the Room Setup table?"),
					() => {
						frm.call({
							doc: frm.doc,
							method: "generate_rooms",
							freeze: true,
							freeze_message: __("Creating rooms and bedspaces..."),
							callback: () => frm.reload_doc(),
						});
					}
				);
			}).addClass("btn-primary");

			frm.add_custom_button(__("Rooms"), () => {
				frappe.set_route("List", "Accommodation Room", { accommodation: frm.doc.name });
			}, __("View"));

			frm.add_custom_button(__("Bedspaces"), () => {
				frappe.set_route("List", "Accommodation Bed", { accommodation: frm.doc.name });
			}, __("View"));

			frm.add_custom_button(__("Occupancy Tracker"), () => {
				frappe.set_route("query-report", "Accommodation Occupancy Tracker", {
					accommodation: frm.doc.name,
				});
			}, __("View"));
		}

		render_occupancy(frm);
	},

	company(frm) {
		if (!frm.doc.company) return;
		frappe.db.get_value("Company", frm.doc.company, "country").then((r) => {
			const country = r.message && r.message.country;
			if (country === "United Arab Emirates") frm.set_value("region", "UAE");
			else if (country === "Saudi Arabia") frm.set_value("region", "KSA");
		});
	},
});

function render_occupancy(frm) {
	if (frm.is_new() || !frm.doc.total_beds) return;
	const d = frm.doc;
	const seg = (n, color) => `<div style="width:${(n / d.total_beds) * 100}%;background:${color}"></div>`;
	const html = `
		<div style="font-size:13px">
			<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:#e8eae6">
				${seg(d.occupied_beds || 0, "#B0492E")}
				${seg(d.reserved_beds || 0, "#B57614")}
				${seg(d.available_beds || 0, "#0F6E56")}
				${seg(d.blocked_beds || 0, "#8A8880")}
			</div>
			<div style="margin-top:8px;color:#6E7A76">
				<b style="color:#B0492E">${d.occupied_beds || 0}</b> occupied &nbsp;
				<b style="color:#B57614">${d.reserved_beds || 0}</b> reserved &nbsp;
				<b style="color:#0F6E56">${d.available_beds || 0}</b> available &nbsp;
				<b style="color:#8A8880">${d.blocked_beds || 0}</b> blocked &nbsp;of ${d.total_beds} beds
			</div>
		</div>`;
	frm.dashboard.clear_headline();
	frm.dashboard.set_headline(html);
}
