// Copyright (c) 2026, Tripod Group and contributors
// For license information, please see license.txt

frappe.ui.form.on("Accommodation Room", {
	refresh(frm) {
		if (frm.is_new()) return;

		frm.add_custom_button(__("Bedspaces"), () => {
			frappe.set_route("List", "Accommodation Bed", { room: frm.doc.name });
		});

		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Accommodation Bed",
				filters: { room: frm.doc.name },
				fields: ["bed_no", "status", "current_employee", "reserved_for"],
				order_by: "bed_no",
				limit_page_length: 0,
			},
			callback: (r) => render_beds(frm, r.message || []),
		});
	},
});

function render_beds(frm, beds) {
	if (!beds.length) return;
	const colors = {
		Occupied: ["#F8EAE4", "#B0492E"],
		Reserved: ["#FAF0DC", "#B57614"],
		Available: ["#E4F1EC", "#0F6E56"],
		Blocked: ["#EDECE7", "#8A8880"],
	};
	const tiles = beds
		.map((b) => {
			const c = colors[b.status] || colors.Available;
			const who = b.current_employee || b.reserved_for || __("Free");
			return `<div style="flex:1;min-width:110px;background:${c[0]};border:1px solid ${c[1]}33;
				border-radius:6px;padding:8px 10px">
				<div style="font-family:monospace;font-size:11px;color:#6E7A76">${b.bed_no}</div>
				<div style="font-size:12.5px;font-weight:500;color:${c[1]}">${b.status}</div>
				<div style="font-size:11.5px;color:#6E7A76">${frappe.utils.escape_html(who)}</div>
			</div>`;
		})
		.join("");
	frm.dashboard.clear_headline();
	frm.dashboard.set_headline(`<div style="display:flex;gap:8px;flex-wrap:wrap">${tiles}</div>`);
}
