//console.log("✅ Backdate Permission JS loaded");

// ---------------------------
// Shared function: populate date_field options for a row
// ---------------------------
function populate_date_field_for_row(frm, row) {
    const cdt = row.doctype;
    const cdn = row.name;

    if (!row.doc_type) return;

    const selected_value = row.date_field;

    frappe.call({
        method: "backdate_entry.backdate_entry.doctype.backdate_permission.backdate_permission.get_date_fields",
        args: { doctype_name: row.doc_type },
        callback: function(r) {
            if (!r.message) return;

            const options = ["", ...r.message.map(f => f.fieldname)];

            // Store labels for messages
            row._field_labels = {};
            r.message.forEach(f => row._field_labels[f.fieldname] = f.label);

            const grid = frm.fields_dict.permission_details?.grid;
            if (!grid) return;

            const grid_row = grid.grid_rows_by_docname[row.name];
            if (!grid_row) return;

            // Retry until date_field control exists
            const waitForField = () => {
                const date_field_control = grid_row.get_field("date_field");
                if (!date_field_control) {
                    setTimeout(waitForField, 50);
                    return;
                }

                // Set options
                date_field_control.df.options = options;

                // Restore previously selected value if still valid
                if (selected_value && options.includes(selected_value)) {
                    frappe.model.set_value(cdt, cdn, "date_field", selected_value);
                }

                date_field_control.refresh();
            };

            waitForField();
        }
    });
}

// ---------------------------
// Parent DocType events
// ---------------------------
frappe.ui.form.on('Backdate Permission', {
    refresh(frm) {
        const grid = frm.fields_dict.permission_details?.grid;
        if (!grid) return;

        //console.log("🔄 Backdate Permission form refreshed");

        // Populate date_field for ALL existing rows
        frm.doc.permission_details.forEach(row => {
            if (!row.doc_type) return;

            const grid_row = grid.grid_rows_by_docname[row.name];

            if (grid_row) {
                //console.log("📄 Populating date_field for existing row:", row.name, row.doc_type);
                populate_date_field_for_row(frm, row);
            } else {
                // If grid_row not rendered yet, populate after next render
                const handler = () => {
                    const gr = grid.grid_rows_by_docname[row.name];
                    if (gr) {
                        populate_date_field_for_row(frm, row);
                        grid.wrapper.off('grid-rendered', handler); // remove listener
                    }
                };
                grid.wrapper.on('grid-rendered', handler);
            }
        });

        // Bind new row added
        grid.on_row_add = function(grid_row) {
            //console.log("➕ New row added:", grid_row.doc.name);

            if (grid_row.doc.doc_type) {
                populate_date_field_for_row(frm, grid_row.doc);
            }
        };
    }
});

// ---------------------------
// Child table events
// ---------------------------
frappe.ui.form.on('Backdate Permission Detail', {

    // 🔹 When DocType is selected or changed
    doc_type(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        populate_date_field_for_row(frm, row);
    },

    // 🔹 Permission type logic
    permission_type(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        if (row.permission_type === "User") {
            frappe.model.set_value(cdt, cdn, "role", "");
            frm.fields_dict.permission_details.grid.update_docfield_property("user", "read_only", 0);
            frm.fields_dict.permission_details.grid.update_docfield_property("role", "read_only", 1);
        } else if (row.permission_type === "Role") {
            frappe.model.set_value(cdt, cdn, "user", "");
            frm.fields_dict.permission_details.grid.update_docfield_property("user", "read_only", 1);
            frm.fields_dict.permission_details.grid.update_docfield_property("role", "read_only", 0);
        } else {
            frm.fields_dict.permission_details.grid.update_docfield_property("user", "read_only", 0);
            frm.fields_dict.permission_details.grid.update_docfield_property("role", "read_only", 0);
        }
    },

    // 🔹 Prevent duplicate date_field for same DocType
    date_field(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (!row.doc_type || !row.date_field) return;

        const label = row._field_labels ? row._field_labels[row.date_field] : row.date_field;

        const duplicates = frm.doc.permission_details.filter(
            r => r.doc_type === row.doc_type && r.date_field === row.date_field && r.name !== row.name
        );

        if (duplicates.length > 0) {
            frappe.msgprint({
                title: "Duplicate Entry",
                message: `A record already exists for <b>${row.doc_type}</b> with date field <b>${label}</b>.`,
                indicator: "red"
            });
            frappe.model.set_value(cdt, cdn, "date_field", "");
        }
    },

    // 🔹 When a new row is added
    permission_details_add(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.doc_type) populate_date_field_for_row(frm, row);
    }
});
