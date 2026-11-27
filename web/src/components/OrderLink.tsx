import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

export const orderPath = (id: string) => `/orders/${id}`;

// Clicks that land on these keep doing their own job (Accept, Recommend,
// links, form fields) instead of opening the order.
const INTERACTIVE = "a, button, input, select, textarea, label, [role='combobox']";

// Should a click on an order card/row open the order page?
export function shouldOpenOrder(container: Element, target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  // React bubbles events from portals (dialogs, dropdowns) through the tree,
  // so a click inside a row's Recommend dialog reaches the row. Ignore
  // anything that isn't actually inside the card/row in the DOM.
  if (!container.contains(target)) return false;
  if (target.closest(INTERACTIVE)) return false;
  // Selecting text (e.g. copying an address) shouldn't navigate away.
  if (window.getSelection()?.toString()) return false;
  return true;
}

// onClick for a whole order card or table row: opens /orders/:id.
export function useOpenOrderOnClick() {
  const navigate = useNavigate();
  return useCallback(
    (id: string) => (e: React.MouseEvent<HTMLElement>) => {
      if (shouldOpenOrder(e.currentTarget, e.target)) navigate(orderPath(id));
    },
    [navigate],
  );
}

// The order's name as a real link, so it works with keyboard and
// middle-click / open-in-new-tab too.
export function OrderTitleLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link to={orderPath(id)} className="font-semibold hover:underline focus-visible:underline">
      {children}
    </Link>
  );
}
