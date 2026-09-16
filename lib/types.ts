export type ExpenseStatus = "pending" | "approved" | "rejected" | "reimbursed";

export const BILL_TYPES = ["digital", "physical", "unbilled_upi", "unbilled_cash"] as const;
export type BillType = (typeof BILL_TYPES)[number];

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  digital: "Digital bill",
  physical: "Physical bill",
  unbilled_upi: "Unbilled (UPI)",
  unbilled_cash: "Unbilled (Cash)",
};

/** What the attachment is for each type, and whether it's mandatory. */
export const BILL_ATTACHMENT: Record<BillType, { label: string; required: boolean }> = {
  digital: { label: "Attach the bill", required: true },
  physical: { label: "Photo or scan of the bill", required: true },
  unbilled_upi: { label: "UPI payment screenshot", required: true },
  unbilled_cash: { label: "Proof of payment (optional)", required: false },
};

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "member";
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  event_date: string | null;
  description: string | null;
  created_by: string | null;
  onedrive_folder_id: string | null;
  onedrive_sheet_id: string | null;
  sheet_web_url: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  event_id: string;
  item_desc: string;
  vendor_name: string;
  amount: number;
  invoice_date: string;
  invoice_number: string | null;
  bill_type: BillType | null;
  bill_path: string | null;
  bill_link: string | null;
  bill_onedrive_id: string | null;
  paid_by: string;
  status: ExpenseStatus;
  reimbursed_at: string | null;
  excel_row_id: string | null;
  created_at: string;
  updated_at: string;
  payer_email?: string;
  payer_name?: string | null;
}
