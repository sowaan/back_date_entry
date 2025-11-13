# Copyright (c) 2025, Sowaan and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, today, date_diff
import json
class BackdatePermission(Document):
	pass

def check_back_date_permission(doc, method=None):
    """
    Check if backdated entry is allowed for this DocType and current user/role.
    Uses the selected date_field from Backdate Permission Detail (child table).
    """

    #frappe.msgprint(f"Backdate check triggered for {doc.doctype}")
    today_date = getdate(today())
    doc_date = None
    date_field_used = None

    # 1️⃣ Get the single Backdate Permission document
    try:
        perm = frappe.get_doc("Backdate Permission")
    except frappe.DoesNotExistError:
        frappe.msgprint("No Backdate Permission setup found.")
        return  # No setup → skip or allow

    if not perm.permission_details:
        return  # No child table rows → skip

    allowed = False

    # 2️⃣ Iterate over child table rows matching this DocType
    for row in perm.permission_details:
        if row.doc_type != doc.doctype:
            continue

        # Skip if date_field is missing or not present in the document
        if not row.date_field or row.date_field not in doc.as_dict():
            continue

        date_field_used = row.date_field
        doc_date = getdate(doc.get(row.date_field))

        # Skip if not backdated
        diff_days = date_diff(today_date, doc_date)
        if diff_days <= 0:
            return

        # Check permission by user or role
        if row.permission_type == "User" and row.user == frappe.session.user:
            if diff_days <= row.allowed_days:
                allowed = True
                break

        elif row.permission_type == "Role":
            user_roles = frappe.get_roles(frappe.session.user)
            if row.role in user_roles and diff_days <= row.allowed_days:
                allowed = True
                break

    # 3️⃣ If not allowed → block
    if not allowed and date_field_used:
        frappe.throw(
    (
        f"Backdating {doc.doctype} by {diff_days} day(s) using "
        f"'{date_field_used.replace('_', ' ').title()}' is not allowed for this user or role. "
        f"Please select a valid date within the allowed range."
    )
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
