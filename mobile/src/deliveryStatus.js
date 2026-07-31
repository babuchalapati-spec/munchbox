// Shared status styling for delivery-partner screens — a colored pill instead of plain
// text, consistent between the orders list and the order detail screen.
export const STATUS_META = {
  placed: { label: 'Placed', color: '#6b7280', bg: '#f1f2f4' },
  confirmed: { label: 'Confirmed', color: '#1565c0', bg: '#e3f0fd' },
  baking: { label: 'Preparing', color: '#a86b00', bg: '#fdf1dc' },
  ready: { label: 'Ready for pickup', color: '#a86b00', bg: '#fdf1dc' },
  heading_to_shop: { label: 'Heading to shop', color: '#6a1b9a', bg: '#f3e5f5' },
  out_for_delivery: { label: 'Out for delivery', color: '#00897b', bg: '#e0f2f1' },
  delivered: { label: 'Delivered', color: '#2e7d32', bg: '#e6f4ea' },
  cancelled: { label: 'Cancelled', color: '#c62828', bg: '#fdecea' },
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: status, color: '#6b7280', bg: '#f1f2f4' };
}
