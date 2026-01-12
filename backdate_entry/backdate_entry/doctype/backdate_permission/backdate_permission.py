# Copyright (c) 2025, Sowaan and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, today, date_diff
import json
class BackdatePermission(Document):
	pass

def check_back_date_permission(doc, method=None):
    today_date = getdate(today())

    try:
        perm = frappe.get_doc("Backdate Permission")
    except frappe.DoesNotExistError:
        return  # No setup → allow

    if not perm.permission_details:
        return

    allowed = False
    applicable_rule_found = False
    date_field_used = None
    diff_days = 0

    user = frappe.session.user
    user_roles = frappe.get_roles(user)

    for row in perm.permission_details:
        # 1️⃣ Match DocType
        if row.doc_type != doc.doctype:
            continue

        # 2️⃣ Match permission target FIRST
        if row.permission_type == "User":
            if row.user != user:
                continue
        elif row.permission_type == "Role":
            if row.role not in user_roles:
                continue
        else:
            continue

        applicable_rule_found = True

        # 3️⃣ Validate date field
        if not row.date_field or row.date_field not in doc.as_dict():
            continue

        doc_date = getdate(doc.get(row.date_field))
        diff_days = date_diff(today_date, doc_date)

        # Not backdated → always allowed
        if diff_days <= 0:
            return

        # 4️⃣ Check allowed days
        if diff_days <= row.allowed_days:
            allowed = True
            return  # Allowed → exit safely

        # Save for error message ONLY if rule applies
        date_field_used = row.date_field

    # 5️⃣ Block only if a relevant rule existed
    if applicable_rule_found and not allowed:
        frappe.throw(
            f"Backdating {doc.doctype} by {diff_days} day(s) using "
            f"'{date_field_used.replace('_', ' ').title()}' is not allowed for this user or role. "
            f"Please select a valid date within the allowed range."
        )


@frappe.whitelist()
def get_date_fields(doctype_name):
    """Return all date and datetime fields for a given DocType."""
    
    if not doctype_name:
        return []
    try:
        meta = frappe.get_meta(doctype_name)
        date_fields = [
            {"fieldname": df.fieldname, "label": df.label}
            for df in meta.fields
            if df.fieldtype in ["Date", "Datetime"]
        ]
        #frappe.msgprint(f"Fields {date_fields}")
        return date_fields
    except Exception as e:
        frappe.log_error(f"Error getting date fields: {e}")
        return []
