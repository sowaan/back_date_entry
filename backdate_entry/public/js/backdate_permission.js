// ============================================================
// Backdate Permission JS
// ============================================================

// ---------------------------
// Populate date_field options for a child row
// ---------------------------
function populate_date_field_for_row(frm, row) {
    if (!row.doc_type) return;

    const cdt = row.doctype;
    const cdn = row.name;
    const selected_value = row.date_field;

    frappe.call({
        method: "backdate_entry.backdate_entry.doctype.backdate_permission.backdate_permission.get_date_fields",
        args: { doctype_name: row.doc_type },
        callback(r) {
            if (!r.message) return;

            const options = ["", ...r.message.map(f => f.fieldname)];

            // Cache labels (UI only)
            row._field_labels = {};
            r.message.forEach(f => {
                row._field_labels[f.fieldname] = f.label;
            });

            const grid = frm.fields_dict.permission_details?.grid;
            if (!grid) return;

            const grid_row = grid.grid_rows_by_docname[row.name];
            if (!grid_row) return;

            const waitForField = () => {
                const ctrl = grid_row.get_field("date_field");
                if (!ctrl) {
                    setTimeout(waitForField, 50);
                    return;
                }

                ctrl.df.options = options;

                if (selected_value && options.includes(selected_value)) {
                    frappe.model.set_value(cdt, cdn, "date_field", selected_value);
                }

                ctrl.refresh();
            };

            waitForField();
        }
    });
}

// ---------------------------
// Duplicate validation (shared)
// ---------------------------
function validate_backdate_permission_row(frm, row) {
    if (!row.doc_type || !row.date_field || !row.permission_type) return;

    if (row.permission_type === "User" && !row.user) return;
    if (row.permission_type === "Role" && !row.role) return;

    const label = row._field_labels
        ? row._field_labels[row.date_field]
        : row.date_field;

    const duplicates = frm.doc.permission_details.filter(r => {
        if (r.name === row.name) return false;
        if (r.doc_type !== row.doc_type) return false;
        if (r.date_field !== row.date_field) return false;
        if (r.permission_type !== row.permission_type) return false;

        if (row.permission_type === "User") {
            return r.user === row.user;
        }

        if (row.permission_type === "Role") {
            return r.role === row.role;
        }

        return false;
    });

    if (duplicates.length > 0) {
        const target =
            row.permission_type === "User"
                ? `User <b>${row.user}</b>`
                : `Role <b>${row.role}</b>`;

        frappe.msgprint({
            title: "Duplicate Entry",
            message: `
                A permission already exists for:
                <br><br>
                • DocType: <b>${row.doc_type}</b><br>
                • Date Field: <b>${label}</b><br>
                • ${target}
            `,
            indicator: "red"
        });

        // Reset only last field
        if (row.permission_type === "User") {
            frappe.model.set_value(row.doctype, row.name, "user", "");
        } else {
            frappe.model.set_value(row.doctype, row.name, "role", "");
        }
    }
}

// ============================================================
// Parent DocType Events
// ============================================================
frappe.ui.form.on('Backdate Permission', {

    refresh(frm) {
        const grid = frm.fields_dict.permission_details?.grid;
        if (!grid) return;

        // Populate date fields for existing rows
        (frm.doc.permission_details || []).forEach(row => {
            populate_date_field_for_row(frm, row);
        });

        // Handle newly added rows
        grid.on_row_add = (grid_row) => {
            populate_date_field_for_row(frm, grid_row.doc);
        };
    }
});

// ============================================================
// Child Table Events
// ============================================================
frappe.ui.form.on('Backdate Permission Detail', {

    doc_type(frm, cdt, cdn) {
    const row = locals[cdt][cdn];

    // 🔥 HARD RESET — DocType change invalidates everything
    frappe.model.set_value(cdt, cdn, {
        date_field: "",
        permission_type: "",
        user: "",
        role: "",
        allowed_days: ""
    });

    // Populate date fields AFTER reset
    populate_date_field_for_row(frm, row);
    },


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

        validate_backdate_permission_row(frm, row);
    },

    date_field(frm, cdt, cdn) {
        validate_backdate_permission_row(frm, locals[cdt][cdn]);
    },

    user(frm, cdt, cdn) {
        validate_backdate_permission_row(frm, locals[cdt][cdn]);
    },

    role(frm, cdt, cdn) {
        validate_backdate_permission_row(frm, locals[cdt][cdn]);
    }
});
