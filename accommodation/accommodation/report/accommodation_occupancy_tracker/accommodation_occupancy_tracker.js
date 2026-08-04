// Copyright (c) 2026, Tripod Group and contributors
// For license information, please see license.txt

frappe.query_reports["Accommodation Occupancy Tracker"] = {
	filters: [
		{ fieldname: "company", label: __("Company"), fieldtype: "Link", options: "Company" },
		{ fieldname: "region", label: __("Region"), fieldtype: "Select", options: "\nUAE\nKSA\nOther" },
		{ fieldname: "accommodation", label: __("Accommodation"), fieldtype: "Link", options: "Accommodation" },
		{
			fieldname: "status",
			label: __("Bed Status"),
			fieldtype: "Select",
			options: "\nOccupied\nReserved\nAvailable\nBlocked",
		},
	],

	formatter(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "status" && data) {
			const colors = {
				Occupied: "#B0492E",
				Reserved: "#B57614",
				Available: "#0F6E56",
				Blocked: "#8A8880",
			};
			const c = colors[data.status];
			if (c) value = `<span style="color:${c};font-weight:600">${data.status}</span>`;
		}
		return value;
	},
};
