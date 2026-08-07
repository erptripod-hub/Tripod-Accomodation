// Copyright (c) 2026, Tripod Group and contributors
// For license information, please see license.txt

frappe.pages["accommodation-tracker"].on_page_load = function (wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Accommodation"),
		single_column: true,
	});
	new AccommodationTracker(wrapper);
};

const API = "accommodation.accommodation.api.";

const COLORS = {
	Occupied: ["#F8EAE4", "#B0492E", "#EDD3C9"],
	Reserved: ["#FAF0DC", "#B57614", "#EEDDB8"],
	Available: ["#E4F1EC", "#0F6E56", "#CBE4DA"],
	Blocked: ["#EDECE7", "#8A8880", "#DEDCD5"],
};

class AccommodationTracker {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.company = null;
		this.view = { name: "home" };
		this.inject_styles();
		this.build_toolbar();
		this.$body = $('<div class="acc-root"></div>').appendTo(this.page.main);
		this.load_home();
	}

	// ----------------------------------------------------------------- chrome

	inject_styles() {
		if (document.getElementById("acc-tracker-styles")) return;
		const css = `
.acc-root{--ink:#101B18;--ink3:#6E7A76;--line:#E2E5DF;--card:#fff;
 --occ:#B0492E;--res:#B57614;--vac:#0F6E56;--blk:#8A8880;color:var(--ink);padding-bottom:60px}
.acc-root .crumb{display:flex;gap:8px;font-size:13px;color:var(--ink3);margin-bottom:14px;flex-wrap:wrap;align-items:center}
.acc-root .crumb a{color:var(--vac);font-weight:500;cursor:pointer}
.acc-root .eyebrow{font-family:monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-bottom:3px}
.acc-root h2.acc-h{font-size:26px;font-weight:600;margin:0 0 3px;letter-spacing:-.02em}
.acc-root .alert{background:#FCF4E4;border:1px solid #EEDDB8;border-left:3px solid var(--res);
 border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;display:flex;gap:18px;flex-wrap:wrap}
.acc-root .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:1px;
 background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin-bottom:20px}
.acc-root .stat{background:var(--card);padding:12px 14px}
.acc-root .stat .k{font-family:monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);white-space:nowrap}
.acc-root .stat .v{font-size:25px;font-weight:600;line-height:1.2;margin-top:2px}
.acc-root .sec{font-family:monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;
 color:var(--ink3);margin:24px 0 11px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.acc-root .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}
.acc-root .acc-card{background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;
 cursor:pointer;transition:transform .18s,box-shadow .18s}
.acc-root .acc-card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(16,27,24,.1)}
.acc-root .pic{position:relative;height:170px;background:#DCE3DD;overflow:hidden}
.acc-root .pic svg,.acc-root .pic img{display:block;width:100%;height:100%;object-fit:cover}
.acc-root .pill{position:absolute;top:10px;left:10px;background:rgba(12,31,26,.86);color:#fff;
 font-family:monospace;font-size:10.5px;padding:3px 8px;border-radius:3px}
.acc-root .pill.r{left:auto;right:10px;background:rgba(255,255,255,.94);color:var(--ink)}
.acc-root .acc-card .body{padding:14px 16px 16px}
.acc-root .acc-card h3{font-size:18px;font-weight:600;margin:0}
.acc-root .meta{font-size:12.5px;color:var(--ink3);margin-top:2px}
.acc-root .bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden;display:flex;margin:12px 0 8px}
.acc-root .bar i{display:block;height:100%}
.acc-root .legrow{display:flex;gap:12px;font-size:12.5px;flex-wrap:wrap;color:#3A4744}
.acc-root .dot{width:9px;height:9px;border-radius:2px;display:inline-block;margin-right:5px;vertical-align:-1px}
.acc-root .grid3{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.acc-root .room{background:var(--card);border:1px solid var(--line);border-radius:7px;padding:12px;
 cursor:pointer;transition:border-color .15s,transform .15s}
.acc-root .room:hover{border-color:#3A4744;transform:translateY(-2px)}
.acc-root .rno{font-family:monospace;font-size:15px;font-weight:600}
.acc-root .rtype{font-size:11.5px;color:var(--ink3);margin-top:1px}
.acc-root .bm{display:flex;gap:4px;margin-top:10px}
.acc-root .bm b{flex:1;height:24px;border-radius:3px;display:block}
.acc-root .cnt{font-size:12px;margin-top:8px;font-weight:500;color:#3A4744}
.acc-root .bedgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(224px,1fr));gap:11px}
.acc-root .bed{border:1px solid var(--line);border-radius:7px;padding:11px 12px;display:flex;gap:10px;
 align-items:center;cursor:pointer;transition:transform .15s,box-shadow .15s}
.acc-root .bed:hover{transform:translateY(-2px);box-shadow:0 5px 13px rgba(16,27,24,.09)}
.acc-root .av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:600;font-size:13px;flex:none}
.acc-root .bno{font-family:monospace;font-size:10.5px;color:var(--ink3)}
.acc-root .nm{font-size:14px;font-weight:500;line-height:1.3}
.acc-root .sub{font-size:11.5px;color:var(--ink3)}
.acc-root .xflag{display:inline-block;background:#0C1F1A;color:#fff;font-family:monospace;font-size:9px;
 padding:1px 5px;border-radius:2px;margin-left:5px;vertical-align:1px}
.acc-root .info{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin-bottom:20px}
.acc-root .info table{width:100%;font-size:13.5px}
.acc-root .info td{padding:5px 0;vertical-align:top}
.acc-root .info td:first-child{color:var(--ink3);width:190px}
.acc-root .info td:last-child{font-weight:500}
.acc-root .tblwrap{background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:auto}
.acc-root table.data{width:100%;font-size:13px;margin:0}
.acc-root table.data th{text-align:left;font-family:monospace;font-size:10px;letter-spacing:.09em;
 text-transform:uppercase;color:var(--ink3);padding:10px 13px;border-bottom:1px solid var(--line);white-space:nowrap;font-weight:500}
.acc-root table.data td{padding:9px 13px;border-bottom:1px solid var(--line);white-space:nowrap}
.acc-root table.data tr:last-child td{border-bottom:none}
.acc-root .st{font-family:monospace;font-size:10px;padding:2px 7px;border-radius:3px}
.acc-root .empty{color:var(--ink3);font-size:13.5px;padding:26px;text-align:center;
 background:var(--card);border:1px dashed var(--line);border-radius:8px}
.acc-root .hint{font-size:12.5px;color:var(--ink3);margin-top:10px}
`;
		$("<style id='acc-tracker-styles'></style>").text(css).appendTo(document.head);
	}

	build_toolbar() {
		this.company_field = this.page.add_field({
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			change: () => {
				this.company = this.company_field.get_value() || null;
				this.view.name === "tracker" ? this.load_tracker() : this.load_home();
			},
		});

		this.page.set_primary_action(__("New Allocation"), () =>
			frappe.new_doc("Accommodation Allocation")
		);

		this.page.add_menu_item(__("Reserve Beds"), () => this.dialog_bulk_reserve());

		this.page.add_menu_item(__("Properties"), () => this.load_home());
		this.page.add_menu_item(__("Live Tracker"), () => this.load_tracker());
		this.page.add_menu_item(__("Occupancy Report"), () =>
			frappe.set_route("query-report", "Accommodation Occupancy Tracker")
		);

		this.$tabs = $(`
			<div style="display:flex;gap:6px;margin:0 0 18px">
				<button class="btn btn-xs btn-default" data-tab="home">${__("Properties")}</button>
				<button class="btn btn-xs btn-default" data-tab="tracker">${__("Live tracker")}</button>
			</div>`).appendTo(this.page.main);

		this.$tabs.on("click", "button", (e) => {
			const tab = $(e.currentTarget).data("tab");
			tab === "tracker" ? this.load_tracker() : this.load_home();
		});
	}

	set_tab(name) {
		this.$tabs.find("button").removeClass("btn-primary").addClass("btn-default");
		this.$tabs.find(`button[data-tab="${name}"]`).removeClass("btn-default").addClass("btn-primary");
	}

	// ----------------------------------------------------------------- helpers

	esc(v) {
		return frappe.utils.escape_html(v == null ? "" : String(v));
	}

	fmt_date(d) {
		return d ? frappe.datetime.str_to_user(d) : "—";
	}

	initials(n) {
		return (n || "?")
			.split(" ")
			.map((w) => w[0])
			.join("")
			.slice(0, 2)
			.toUpperCase();
	}

	stats_html(items) {
		const cells = items
			.map(
				(i) =>
					`<div class="stat"><div class="k">${this.esc(i[0])}</div>
					 <div class="v" ${i[2] ? `style="color:${i[2]}"` : ""}>${this.esc(i[1])}</div></div>`
			)
			.join("");
		return `<div class="stats">${cells}</div>`;
	}

	tally_stats(t, extra = []) {
		return this.stats_html(
			extra.concat([
				[__("Total beds"), t.total],
				[__("Occupied"), t.Occupied, "var(--occ)"],
				[__("Reserved"), t.Reserved, "var(--res)"],
				[__("Available"), t.Available, "var(--vac)"],
				[__("Blocked"), t.Blocked, "var(--blk)"],
				[__("Occupancy"), t.pct + "%"],
			])
		);
	}

	seg_bar(t) {
		if (!t.total) return "";
		const p = (n) => (n / t.total) * 100;
		return `<div class="bar">
			<i style="width:${p(t.Occupied)}%;background:var(--occ)"></i>
			<i style="width:${p(t.Reserved)}%;background:var(--res)"></i>
			<i style="width:${p(t.Available)}%;background:var(--vac)"></i>
			<i style="width:${p(t.Blocked)}%;background:var(--blk)"></i></div>`;
	}

	legend() {
		return `<div class="legrow" style="margin-top:14px">
			<span><span class="dot" style="background:var(--occ)"></span>${__("Occupied")}</span>
			<span><span class="dot" style="background:var(--res)"></span>${__("Reserved")}</span>
			<span><span class="dot" style="background:var(--vac)"></span>${__("Available")}</span>
			<span><span class="dot" style="background:var(--blk)"></span>${__("Blocked")}</span></div>`;
	}

	art(type, image) {
		if (image) return `<img src="${this.esc(image)}" alt="">`;
		if (type === "Labour Camp") {
			let w = "";
			for (let i = 0; i < 5; i++)
				for (let j = 0; j < 2; j++)
					w += `<rect x="${30 + i * 28}" y="${74 + j * 26}" width="17" height="15"/>`;
			for (let i = 0; i < 4; i++)
				for (let j = 0; j < 3; j++)
					w += `<rect x="${188 + i * 28}" y="${58 + j * 24}" width="17" height="14"/>`;
			for (let i = 0; i < 3; i++) w += `<rect x="${314 + i * 24}" y="88" width="15" height="14"/>`;
			return `<svg viewBox="0 0 400 170" preserveAspectRatio="xMidYMid slice">
				<rect width="400" height="170" fill="#D7E2E4"/><circle cx="330" cy="38" r="18" fill="#F2E3C4"/>
				<rect y="124" width="400" height="46" fill="#CFC9B4"/>
				<rect x="18" y="62" width="150" height="62" fill="#8FA3A8"/><rect x="18" y="55" width="150" height="9" fill="#63797F"/>
				<rect x="176" y="48" width="120" height="76" fill="#A2B4B7"/><rect x="176" y="41" width="120" height="9" fill="#63797F"/>
				<rect x="304" y="76" width="82" height="48" fill="#8FA3A8"/><rect x="304" y="69" width="82" height="9" fill="#63797F"/>
				<g fill="#EAF0EF">${w}</g>
				<rect x="86" y="100" width="20" height="24" fill="#5C6B6E"/><rect x="212" y="102" width="22" height="22" fill="#5C6B6E"/>
				<path d="M0 150h400" stroke="#BDB8A2" stroke-width="6" stroke-dasharray="18 14"/>
				<g fill="#6E8C5A"><circle cx="360" cy="112" r="12"/><circle cx="12" cy="108" r="10"/></g></svg>`;
		}
		let v = "";
		for (let k = 0; k < 3; k++)
			for (let m = 0; m < 2; m++)
				v += `<rect x="${68 + k * 40}" y="${72 + m * 34}" width="24" height="24" rx="2"/>`;
		for (let n = 0; n < 3; n++) v += `<rect x="${204 + n * 34}" y="86" width="22" height="22" rx="2"/>`;
		return `<svg viewBox="0 0 400 170" preserveAspectRatio="xMidYMid slice">
			<rect width="400" height="170" fill="#E6DFD0"/><circle cx="66" cy="36" r="20" fill="#F5E9CC"/>
			<rect y="132" width="400" height="38" fill="#D2C7AE"/>
			<rect x="52" y="56" width="140" height="76" fill="#EFE7D6"/><rect x="192" y="72" width="112" height="60" fill="#E4D9C2"/>
			<rect x="44" y="48" width="156" height="10" fill="#A6947A"/><rect x="186" y="64" width="126" height="10" fill="#A6947A"/>
			<g fill="#7E9EA8">${v}</g>
			<rect x="112" y="108" width="22" height="24" fill="#8B6F4E"/><rect x="236" y="110" width="20" height="22" fill="#8B6F4E"/>
			<g fill="#5F7D4F"><rect x="20" y="110" width="5" height="22"/><path d="M22 110 8 94h28z"/>
			<rect x="342" y="104" width="5" height="28"/><path d="M344 104 328 86h32z"/></g></svg>`;
	}

	call(method, args) {
		return frappe.call({ method: API + method, args: args || {}, freeze: false }).then((r) => r.message);
	}

	loading() {
		this.$body.html(`<div class="empty">${__("Loading...")}</div>`);
	}

	// ----------------------------------------------------------------- home

	load_home() {
		this.view = { name: "home" };
		this.set_tab("home");
		this.loading();
		this.call("get_overview", { company: this.company }).then((d) => this.render_home(d));
	}

	render_home(d) {
		const t = d.totals;
		let h = `<div class="eyebrow">${__("Module")}</div><h2 class="acc-h">${__("Accommodation")}</h2>
			<div class="meta" style="margin-bottom:16px">${this.esc(this.company || __("All companies"))}</div>`;

		if (d.alerts && d.alerts.length) {
			h += `<div class="alert">${d.alerts.map((a) => `<span>${this.esc(a)}</span>`).join("")}</div>`;
		}

		h += this.tally_stats(t, [
			[__("Accommodations"), d.accommodations.length],
			[__("Rooms"), d.rooms],
		]);

		if (!d.accommodations.length) {
			h += `<div class="sec">${__("Properties")}</div>
				<div class="empty">${__("No accommodation records yet.")}</div>`;
			this.$body.html(h);
			return;
		}

		h += `<div class="sec">${__("Properties")}</div><div class="grid2">`;
		d.accommodations.forEach((a) => {
			const at = a.tally;
			h += `<div class="acc-card" data-acc="${this.esc(a.name)}">
				<div class="pic">${this.art(a.accommodation_type, a.image)}
					<div class="pill">${this.esc(a.name)}</div>
					<div class="pill r">${at.pct}% ${__("full")}</div></div>
				<div class="body"><h3>${this.esc(a.accommodation_name)}</h3>
					<div class="meta">${this.esc(a.city || "")}${a.city ? " · " : ""}${this.esc(a.company)}</div>
					${this.seg_bar(at)}
					<div class="legrow"><span><b>${a.rooms}</b> ${__("rooms")}</span>
						<span><b>${at.Occupied}</b> ${__("occupied")}</span>
						<span style="color:var(--res)"><b>${at.Reserved}</b> ${__("reserved")}</span>
						<span style="color:var(--vac)"><b>${at.Available}</b> ${__("available")}</span></div>
				</div></div>`;
		});
		h += `</div>${this.legend()}<div class="hint">${__("Click a property to open its rooms.")}</div>`;

		this.$body.html(h);
		this.$body.find(".acc-card").on("click", (e) => this.load_accommodation($(e.currentTarget).data("acc")));
	}

	// ----------------------------------------------------------------- property

	load_accommodation(name) {
		this.view = { name: "acc", acc: name };
		this.loading();
		this.call("get_accommodation", { accommodation: name }).then((d) => this.render_accommodation(d));
	}

	render_accommodation(d) {
		const a = d.doc,
			t = d.totals;
		let h = `<div class="crumb"><a data-go="home">${__("Accommodation")}</a><span>›</span>
			<span>${this.esc(a.accommodation_name)}</span></div>
			<div class="eyebrow">${this.esc(a.name)} · ${this.esc(a.accommodation_type || "")} · ${this.esc(a.region || "")}</div>
			<h2 class="acc-h">${this.esc(a.accommodation_name)}</h2>
			<div class="meta" style="margin-bottom:16px">${this.esc(a.city || "")}</div>`;

		h += this.tally_stats(t, [[__("Rooms"), d.rooms.length]]);

		const rent = a.annual_rent
			? format_currency(a.annual_rent, a.currency)
			: "—";
		h += `<div class="info"><table>
			<tr><td>${__("Owning company")}</td><td>${this.esc(a.company)}</td></tr>
			<tr><td>${__("Landlord")}</td><td>${this.esc(a.landlord || "—")}</td></tr>
			<tr><td>${__("Contract period")}</td><td>${this.fmt_date(a.contract_start_date)} → ${this.fmt_date(a.contract_end_date)}</td></tr>
			<tr><td>${__("Annual rent")}</td><td>${rent}</td></tr>
			<tr><td>${__("Municipality permit")}</td><td>${this.esc(a.permit_no || "—")} · ${__("expires")} ${this.fmt_date(a.permit_expiry)}</td></tr>
			<tr><td>${__("Camp supervisor")}</td><td>${this.esc(a.supervisor || "—")}</td></tr>
			</table></div>`;

		if (!d.rooms.length) {
			h += `<div class="sec">${__("Rooms")}</div>
				<div class="empty">${__("No rooms yet. Open the Accommodation record, fill Room Setup and press Generate Rooms.")}</div>`;
			this.$body.html(h);
			this.bind_nav();
			return;
		}

		h += `<div class="sec">${__("Rooms")} — ${d.rooms.length}</div><div class="grid3">`;
		d.rooms.forEach((r) => {
			const strip = (r.strip || [])
				.map((s) => `<b style="background:${COLORS[s] ? COLORS[s][1] : "var(--blk)"}"></b>`)
				.join("");
			h += `<div class="room" data-room="${this.esc(r.name)}">
				<div class="rno">${this.esc(r.room_no)}</div>
				<div class="rtype">${this.esc(r.room_type || "")} · ${r.capacity} ${__("bed")}</div>
				<div class="bm">${strip}</div>
				<div class="cnt">${r.tally.Occupied} ${__("of")} ${r.tally.total} ${__("occupied")}${
					r.tally.Available ? ` · ${r.tally.Available} ${__("free")}` : ""
				}</div></div>`;
		});
		h += `</div>${this.legend()}<div class="hint">${__("Click a room to open its bedspaces.")}</div>`;

		this.$body.html(h);
		this.bind_nav();
		this.$body.find(".room").on("click", (e) => this.load_room($(e.currentTarget).data("room")));
	}

	// ----------------------------------------------------------------- room

	load_room(name) {
		this.view = { name: "room", acc: this.view.acc, room: name };
		this.loading();
		this.call("get_room", { room: name }).then((d) => this.render_room(d));
	}

	render_room(d) {
		const r = d.room,
			t = d.totals;
		this.current_room = d;

		let h = `<div class="crumb"><a data-go="home">${__("Accommodation")}</a><span>›</span>
			<a data-go="acc" data-acc="${this.esc(r.accommodation)}">${this.esc(r.accommodation_name)}</a>
			<span>›</span><span>${__("Room")} ${this.esc(r.room_no)}</span></div>
			<div class="eyebrow">${__("Block")} ${this.esc(r.block || "—")} · ${this.esc(r.room_type || "")}</div>
			<h2 class="acc-h">${__("Room")} ${this.esc(r.room_no)}</h2>
			<div class="meta" style="margin-bottom:16px">${t.Occupied} ${__("occupied")} · ${t.Reserved} ${__(
			"reserved"
		)} · ${t.Available} ${__("available")}</div>`;

		h += `<div class="sec">${__("Bedspaces")} — ${__("click a bed to act")}</div><div class="bedgrid">`;
		d.beds.forEach((b) => {
			const c = COLORS[b.status] || COLORS.Available;
			let av, nm, sub;
			if (b.status === "Occupied") {
				av = this.initials(b.employee_name);
				nm =
					this.esc(b.employee_name || b.current_employee) +
					(b.is_cross_entity ? `<span class="xflag">${__("CROSS ENTITY")}</span>` : "");
				sub = `${this.esc(b.designation || "")} · ${b.duration_days} ${__("days")}`;
			} else if (b.status === "Reserved") {
				av = "◷";
				nm = __("Reserved");
				sub = `${this.esc(b.employee_name || "")} · ${__("arriving")} ${this.fmt_date(b.expected_arrival_date)}`;
			} else if (b.status === "Blocked") {
				av = "—";
				nm = __("Blocked");
				sub = this.esc(b.blocked_reason || "");
			} else {
				av = "+";
				nm = __("Available");
				sub = __("Tap to allocate or reserve");
			}
			h += `<div class="bed" data-bed="${this.esc(b.name)}"
				style="background:${c[0]};border-color:${c[2]}">
				<div class="av" style="background:${
					b.status === "Available" ? "#fff" : c[1]
				};color:${b.status === "Available" ? c[1] : "#fff"};${
				b.status === "Available" ? `border:1px dashed ${c[1]}` : ""
			}">${av}</div>
				<div><div class="bno">${this.esc(b.bed_no)} · ${this.esc(b.bed_position || "")}</div>
				<div class="nm">${nm}</div><div class="sub">${sub}</div></div></div>`;
		});
		h += `</div>${this.legend()}`;

		h += `<div class="sec">${__("Registration record")}</div><div class="tblwrap"><table class="data">
			<thead><tr><th>${__("Bed")}</th><th>${__("Employee")}</th><th>${__("ID")}</th>
			<th>${__("Visa Entity")}</th><th>${__("Check-In")}</th><th>${__("Duration")}</th>
			<th>${__("Status")}</th></tr></thead><tbody>`;
		d.beds.forEach((b) => {
			const c = COLORS[b.status] || COLORS.Available;
			h += `<tr><td class="mono">${this.esc(b.bed_no)}</td>
				<td>${this.esc(b.employee_name || "—")}</td>
				<td>${this.esc(b.current_employee || b.reserved_for || "—")}</td>
				<td>${this.esc(b.employee_company || "—")}</td>
				<td>${this.fmt_date(b.check_in_date || b.expected_arrival_date)}</td>
				<td>${b.duration_days ? b.duration_days + " d" : "—"}</td>
				<td><span class="st" style="background:${c[0]};color:${c[1]}">${this.esc(b.status)}</span></td></tr>`;
		});
		h += `</tbody></table></div>`;

		this.$body.html(h);
		this.bind_nav();
		this.$body.find(".bed").on("click", (e) => this.open_bed($(e.currentTarget).data("bed")));
	}

	bind_nav() {
		this.$body.find("[data-go]").on("click", (e) => {
			const go = $(e.currentTarget).data("go");
			if (go === "home") this.load_home();
			else this.load_accommodation($(e.currentTarget).data("acc"));
		});
	}

	// ----------------------------------------------------------------- actions

	open_bed(bed_name) {
		const bed = this.current_room.beds.find((b) => b.name === bed_name);
		if (!bed) return;
		if (bed.status === "Available") return this.dialog_allocate(bed);
		if (bed.status === "Occupied") return this.dialog_vacate(bed);
		if (bed.status === "Reserved") {
			return bed.bed_reservation
				? this.dialog_bulk_held(bed)
				: this.dialog_reserved(bed);
		}
		return this.dialog_blocked(bed);
	}

	refresh_room() {
		this.load_room(this.current_room.room.name);
	}

	dialog_allocate(bed) {
		const company = this.current_room.room.company;
		const d = new frappe.ui.Dialog({
			title: __("Bed {0} · Room {1}", [bed.bed_no, this.current_room.room.room_no]),
			fields: [
				{
					fieldname: "employee",
					label: __("Employee"),
					fieldtype: "Link",
					options: "Employee",
					reqd: 1,
					get_query: () => ({ filters: { status: "Active" } }),
				},
				{
					fieldname: "allocation_type",
					label: __("Action"),
					fieldtype: "Select",
					options: "Check-In\nReservation",
					default: "Check-In",
					reqd: 1,
				},
				{
					fieldname: "stay_type",
					label: __("Stay Type"),
					fieldtype: "Select",
					options: "Permanent\nDeployment\nTemporary",
					default: "Permanent",
				},
				{
					fieldname: "date",
					label: __("Date"),
					fieldtype: "Date",
					default: frappe.datetime.get_today(),
					reqd: 1,
				},
				{ fieldname: "remarks", label: __("Remarks"), fieldtype: "Small Text" },
				{
					fieldname: "note",
					fieldtype: "HTML",
					options: `<div class="text-muted small">${__(
						"Accommodation owned by {0}. Employees on another entity's visa are allowed and will be flagged as a cross-entity stay.",
						[company]
					)}</div>`,
				},
			],
			primary_action_label: __("Confirm"),
			primary_action: (v) => {
				d.hide();
				frappe.dom.freeze(__("Saving..."));
				this.call("allocate_bed", {
					bed: bed.name,
					employee: v.employee,
					date: v.date,
					allocation_type: v.allocation_type,
					stay_type: v.stay_type,
					remarks: v.remarks,
				})
					.then((r) => {
						frappe.dom.unfreeze();
						frappe.show_alert({
							message: __("Allocation {0} — {1}", [r.allocation, r.status]),
							indicator: "green",
						});
						this.refresh_room();
					})
					.catch(() => frappe.dom.unfreeze());
			},
		});
		d.show();
	}

	dialog_vacate(bed) {
		const d = new frappe.ui.Dialog({
			title: __("Bed {0} · {1}", [bed.bed_no, bed.employee_name || ""]),
			fields: [
				{
					fieldname: "info",
					fieldtype: "HTML",
					options: `<table class="table table-bordered small" style="margin-bottom:12px">
						<tr><td class="text-muted">${__("Employee")}</td><td>${this.esc(bed.employee_name || "")}</td></tr>
						<tr><td class="text-muted">${__("Employee ID")}</td><td>${this.esc(bed.current_employee || "")}</td></tr>
						<tr><td class="text-muted">${__("Designation")}</td><td>${this.esc(bed.designation || "—")}</td></tr>
						<tr><td class="text-muted">${__("Visa entity")}</td><td>${this.esc(bed.employee_company || "—")}</td></tr>
						<tr><td class="text-muted">${__("Check-in")}</td><td>${this.fmt_date(bed.check_in_date)}</td></tr>
						<tr><td class="text-muted">${__("Duration")}</td><td>${bed.duration_days} ${__("days")}</td></tr>
						</table>`,
				},
				{
					fieldname: "date",
					label: __("Vacate Date"),
					fieldtype: "Date",
					default: frappe.datetime.get_today(),
					reqd: 1,
				},
			],
			primary_action_label: __("Vacate Bed"),
			primary_action: (v) => {
				d.hide();
				frappe.dom.freeze(__("Releasing..."));
				this.call("vacate_bed", { bed: bed.name, date: v.date })
					.then(() => {
						frappe.dom.unfreeze();
						frappe.show_alert({ message: __("Bedspace released."), indicator: "green" });
						this.refresh_room();
					})
					.catch(() => frappe.dom.unfreeze());
			},
			secondary_action_label: __("Open Allocation"),
			secondary_action: () => {
				d.hide();
				frappe.set_route("Form", "Accommodation Allocation", bed.current_allocation);
			},
		});
		d.show();
	}

	dialog_reserved(bed) {
		const d = new frappe.ui.Dialog({
			title: __("Bed {0} · {1}", [bed.bed_no, __("Reserved")]),
			fields: [
				{
					fieldname: "info",
					fieldtype: "HTML",
					options: `<table class="table table-bordered small" style="margin-bottom:12px">
						<tr><td class="text-muted">${__("Reserved for")}</td><td>${this.esc(bed.employee_name || "")}</td></tr>
						<tr><td class="text-muted">${__("Employee ID")}</td><td>${this.esc(bed.reserved_for || "")}</td></tr>
						<tr><td class="text-muted">${__("Expected arrival")}</td><td>${this.fmt_date(bed.expected_arrival_date)}</td></tr>
						</table>`,
				},
				{
					fieldname: "date",
					label: __("Check-In Date"),
					fieldtype: "Date",
					default: frappe.datetime.get_today(),
				},
			],
			primary_action_label: __("Check In Now"),
			primary_action: (v) => {
				d.hide();
				frappe.dom.freeze(__("Checking in..."));
				this.call("check_in_bed", { bed: bed.name, date: v.date })
					.then(() => {
						frappe.dom.unfreeze();
						frappe.show_alert({ message: __("Checked in."), indicator: "green" });
						this.refresh_room();
					})
					.catch(() => frappe.dom.unfreeze());
			},
			secondary_action_label: __("Release Reservation"),
			secondary_action: () => {
				d.hide();
				frappe.confirm(__("Release this reservation and free the bedspace?"), () => {
					frappe.dom.freeze(__("Releasing..."));
					this.call("release_reservation", { bed: bed.name })
						.then(() => {
							frappe.dom.unfreeze();
							frappe.show_alert({ message: __("Reservation released."), indicator: "green" });
							this.refresh_room();
						})
						.catch(() => frappe.dom.unfreeze());
				});
			},
		});
		d.show();
	}

	dialog_bulk_held(bed) {
		const d = new frappe.ui.Dialog({
			title: __("Bed {0} · {1}", [bed.bed_no, __("Held")]),
			fields: [
				{
					fieldname: "info",
					fieldtype: "HTML",
					options: `<table class="table table-bordered small" style="margin-bottom:12px">
						<tr><td class="text-muted">${__("Held by")}</td><td>${this.esc(bed.bed_reservation)}</td></tr>
						<tr><td class="text-muted">${__("Held until")}</td><td>${this.fmt_date(bed.reserved_until)}</td></tr>
						<tr><td class="text-muted">${__("Employee")}</td><td>${__("Not yet assigned")}</td></tr>
						</table>
						<div class="text-muted small">${__(
							"This bedspace is held in bulk. Assign an employee to consume the hold, or release it back to available."
						)}</div>`,
				},
				{
					fieldname: "employee",
					label: __("Assign Employee"),
					fieldtype: "Link",
					options: "Employee",
					get_query: () => ({ filters: { status: "Active" } }),
				},
				{
					fieldname: "date",
					label: __("Check-In Date"),
					fieldtype: "Date",
					default: frappe.datetime.get_today(),
				},
			],
			primary_action_label: __("Assign & Check In"),
			primary_action: (v) => {
				if (!v.employee) {
					frappe.msgprint(__("Select an employee."));
					return;
				}
				d.hide();
				frappe.dom.freeze(__("Saving..."));
				this.call("allocate_bed", {
					bed: bed.name,
					employee: v.employee,
					date: v.date,
					allocation_type: "Check-In",
				})
					.then((r) => {
						frappe.dom.unfreeze();
						frappe.show_alert({
							message: __("Allocation {0} — {1}", [r.allocation, r.status]),
							indicator: "green",
						});
						this.refresh_room();
					})
					.catch(() => frappe.dom.unfreeze());
			},
			secondary_action_label: __("Release Bed"),
			secondary_action: () => {
				d.hide();
				frappe.confirm(__("Release this bedspace back to available?"), () => {
					this.call("release_bulk_hold", { bed: bed.name }).then(() => {
						frappe.show_alert({ message: __("Bedspace released."), indicator: "green" });
						this.refresh_room();
					});
				});
			},
		});
		d.show();
	}

	dialog_bulk_reserve() {
		const d = new frappe.ui.Dialog({
			title: __("Reserve Bedspaces"),
			fields: [
				{
					fieldname: "accommodation",
					label: __("Accommodation"),
					fieldtype: "Link",
					options: "Accommodation",
					reqd: 1,
					default: this.view.acc || null,
				},
				{
					fieldname: "room",
					label: __("Room (optional)"),
					fieldtype: "Link",
					options: "Accommodation Room",
					get_query: (doc, cdt, cdn) => ({
						filters: { accommodation: d.get_value("accommodation") },
					}),
				},
				{
					fieldname: "headcount",
					label: __("No. of Beds"),
					fieldtype: "Int",
					reqd: 1,
					default: 5,
				},
				{
					fieldname: "purpose",
					label: __("Purpose"),
					fieldtype: "Select",
					options: "New Joiners\nTransfer\nClient Visit\nOther",
					default: "New Joiners",
				},
				{ fieldtype: "Column Break" },
				{
					fieldname: "reserved_from",
					label: __("Reserved From"),
					fieldtype: "Date",
					reqd: 1,
					default: frappe.datetime.get_today(),
				},
				{
					fieldname: "reserved_until",
					label: __("Reserved Until"),
					fieldtype: "Date",
					reqd: 1,
					default: frappe.datetime.add_days(frappe.datetime.get_today(), 15),
				},
				{ fieldname: "remarks", label: __("Remarks"), fieldtype: "Small Text" },
				{
					fieldname: "note",
					fieldtype: "HTML",
					options: `<div class="text-muted small">${__(
						"Beds are held without naming anyone. They release automatically the day after the end date."
					)}</div>`,
				},
			],
			primary_action_label: __("Reserve"),
			primary_action: (v) => {
				d.hide();
				frappe.dom.freeze(__("Holding bedspaces..."));
				this.call("reserve_beds", v)
					.then((r) => {
						frappe.dom.unfreeze();
						frappe.show_alert({
							message: __("{0} — {1} bed(s) held", [r.reservation, r.beds]),
							indicator: "green",
						});
						this.view.name === "room" ? this.refresh_room() : this.load_home();
					})
					.catch(() => frappe.dom.unfreeze());
			},
		});
		d.show();
	}

	dialog_blocked(bed) {
		frappe.confirm(
			__("Bed {0} is blocked: {1}. Mark it available?", [bed.bed_no, bed.blocked_reason || "—"]),
			() => {
				this.call("set_block", { bed: bed.name, blocked: 0 }).then(() => {
					frappe.show_alert({ message: __("Bedspace is now available."), indicator: "green" });
					this.refresh_room();
				});
			}
		);
	}

	// ----------------------------------------------------------------- tracker

	load_tracker() {
		this.view = { name: "tracker" };
		this.set_tab("tracker");
		this.loading();
		Promise.all([
			this.call("get_overview", { company: this.company }),
			this.call("get_tracker", { company: this.company }),
		]).then(([o, t]) => this.render_tracker(o, t));
	}

	render_tracker(o, d) {
		const t = o.totals;
		let h = `<div class="eyebrow">${__("Real time")}</div><h2 class="acc-h">${__("Live tracker")}</h2>
			<div class="meta" style="margin-bottom:16px">${this.esc(this.company || __("All companies"))}</div>`;

		h += this.tally_stats(t, [
			[__("Accommodations"), o.accommodations.length],
			[__("Rooms"), o.rooms],
		]);

		h += `<div class="sec">${__("Property breakdown")}</div><div class="tblwrap"><table class="data">
			<thead><tr><th>${__("Property")}</th><th>${__("Company")}</th><th>${__("Region")}</th>
			<th>${__("Rooms")}</th><th>${__("Beds")}</th><th>${__("Occupied")}</th><th>${__("Reserved")}</th>
			<th>${__("Available")}</th><th>${__("Blocked")}</th><th>${__("Occupancy")}</th></tr></thead><tbody>`;
		if (!d.by_property.length) {
			h += `<tr><td colspan="10" class="text-muted">${__("No properties")}</td></tr>`;
		}
		d.by_property.forEach((a) => {
			const x = a.tally;
			h += `<tr><td><b>${this.esc(a.accommodation_name)}</b></td><td>${this.esc(a.company)}</td>
				<td>${this.esc(a.region || "")}</td><td>${a.rooms}</td><td>${x.total}</td>
				<td style="color:var(--occ)">${x.Occupied}</td><td style="color:var(--res)">${x.Reserved}</td>
				<td style="color:var(--vac)">${x.Available}</td><td>${x.Blocked}</td><td>${x.pct}%</td></tr>`;
		});
		h += `</tbody></table></div>`;

		h += `<div class="sec">${__("Reservations — arrivals due")} (${d.reserved.length})</div>`;
		if (!d.reserved.length) {
			h += `<div class="empty">${__("No reservations pending.")}</div>`;
		} else {
			h += `<div class="tblwrap"><table class="data"><thead><tr>
				<th>${__("Reserved for")}</th><th>${__("ID")}</th><th>${__("Designation")}</th>
				<th>${__("Property")}</th><th>${__("Room")}</th><th>${__("Bed")}</th>
				<th>${__("Arriving")}</th><th>${__("Days left")}</th></tr></thead><tbody>`;
			d.reserved.forEach((r) => {
				h += `<tr><td><b>${this.esc(r.employee_name || "")}</b></td><td>${this.esc(r.employee || "")}</td>
					<td>${this.esc(r.designation || "")}</td><td>${this.esc(r.accommodation_name || "")}</td>
					<td>${this.esc(r.room_no || "")}</td><td>${this.esc(r.bed_no || "")}</td>
					<td>${this.fmt_date(r.expected_arrival_date)}</td>
					<td>${r.days_left == null ? "—" : r.days_left + " d"}</td></tr>`;
			});
			h += `</tbody></table></div>`;
		}

		h += `<div class="sec">${__("Cross-entity occupancy")} (${d.cross_entity.length})</div>`;
		if (!d.cross_entity.length) {
			h += `<div class="empty">${__("None.")}</div>`;
		} else {
			h += `<div class="tblwrap"><table class="data"><thead><tr>
				<th>${__("Employee")}</th><th>${__("Visa entity")}</th><th>${__("Staying at")}</th>
				<th>${__("Owned by")}</th><th>${__("Room / Bed")}</th><th>${__("Since")}</th>
				<th>${__("Bed-days")}</th></tr></thead><tbody>`;
			d.cross_entity.forEach((c) => {
				h += `<tr><td><b>${this.esc(c.employee_name || "")}</b></td>
					<td>${this.esc(c.employee_company || "")}</td><td>${this.esc(c.accommodation_name || "")}</td>
					<td>${this.esc(c.accommodation_company || "")}</td>
					<td>${this.esc(c.room_no || "")} / ${this.esc(c.bed_no || "")}</td>
					<td>${this.fmt_date(c.check_in_date)}</td><td>${c.duration_days || 0}</td></tr>`;
			});
			h += `</tbody></table></div>`;
		}

		h += `<div class="sec">${__("Recent movements")}</div>`;
		if (!d.movements.length) {
			h += `<div class="empty">${__("No activity yet.")}</div>`;
		} else {
			h += `<div class="tblwrap"><table class="data"><thead><tr>
				<th>${__("When")}</th><th>${__("Employee")}</th><th>${__("Status")}</th>
				<th>${__("Property")}</th><th>${__("Room / Bed")}</th></tr></thead><tbody>`;
			d.movements.forEach((m) => {
				h += `<tr><td>${frappe.datetime.comment_when(m.modified)}</td>
					<td><b>${this.esc(m.employee_name || "")}</b></td><td>${this.esc(m.status)}</td>
					<td>${this.esc(m.accommodation_name || "")}</td>
					<td>${this.esc(m.room_no || "")} / ${this.esc(m.bed_no || "")}</td></tr>`;
			});
			h += `</tbody></table></div>`;
		}

		this.$body.html(h);
	}
}
