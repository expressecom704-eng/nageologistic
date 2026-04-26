-- 1. Remove the aggressive MVP triggers that changed stock instantly on creation
DROP TRIGGER IF EXISTS trigger_decrease_stock ON public.order_items;
DROP FUNCTION IF EXISTS decrease_stock_on_order();

DROP TRIGGER IF EXISTS trigger_order_returned ON public.orders;
DROP FUNCTION IF EXISTS handle_return();

-- 2. Create the ultimate dynamic conditional inventory watcher
CREATE OR REPLACE FUNCTION handle_conditional_stock() RETURNS TRIGGER AS $$
BEGIN
  -- ACTION 1: DEDUCT STOCK
  -- If the order transitions INTO the precise (Delivered AND Paid) state.
  IF NEW.status = 'Delivered' AND NEW.payment_status = 'Paid' THEN
    IF OLD.status <> 'Delivered' OR OLD.payment_status <> 'Paid' THEN
      UPDATE public.products p
      SET quantity = p.quantity - oi.quantity
      FROM public.order_items oi
      WHERE p.id = oi.product_id AND oi.order_id = NEW.id;
    END IF;
  END IF;

  -- ACTION 2: RESTORE STOCK
  -- If the order transitions OUT OF the (Delivered AND Paid) state for any reason 
  -- (e.g., someone marks it 'Returned' or accidentally unmarks it 'Paid').
  IF OLD.status = 'Delivered' AND OLD.payment_status = 'Paid' THEN
    IF NEW.status <> 'Delivered' OR NEW.payment_status <> 'Paid' THEN
      UPDATE public.products p
      SET quantity = p.quantity + oi.quantity
      FROM public.order_items oi
      WHERE p.id = oi.product_id AND oi.order_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach it tightly to the orders pipeline
CREATE TRIGGER trigger_conditional_stock AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION handle_conditional_stock();
