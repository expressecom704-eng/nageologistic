-- ==============================================================================
-- V14: SAFE DATA RESET & UNIFIED STOCK/FINANCIAL LOGIC
-- ==============================================================================

-- 1. SAFE DATA RESET (Preserving Users/Admin)
BEGIN;
  -- Disable triggers temporarily to avoid side effects during reset
  SET session_replication_role = 'replica';

  TRUNCATE TABLE public.logs CASCADE;
  TRUNCATE TABLE public.returns CASCADE;
  TRUNCATE TABLE public.transactions CASCADE;
  TRUNCATE TABLE public.order_items CASCADE;
  TRUNCATE TABLE public.orders CASCADE;
  -- We reset product quantities to 0 but keep the product list if it exists, 
  -- or truncate if you prefer a truly blank slate. Truncating is cleaner for "Fresh Fresh".
  TRUNCATE TABLE public.products CASCADE;

  -- Re-enable triggers
  SET session_replication_role = 'origin';
COMMIT;

-- 2. CLEAN UP OLD TRIGGERS
DROP TRIGGER IF EXISTS trigger_decrease_stock ON public.order_items;
DROP TRIGGER IF EXISTS trigger_order_returned ON public.orders;
DROP TRIGGER IF EXISTS trigger_financial_transaction ON public.orders;

-- 3. UNIFIED STOCK & FINANCIAL ENGINE
-- This engine handles BOTH stock movement and financial ledgering in one place.
-- Logic: Stock is ONLY deducted when Status=Delivered AND Payment=Paid.
-- Logic: Stock is RESTORED if the order moves OUT of that state.

CREATE OR REPLACE FUNCTION handle_order_impacts() RETURNS TRIGGER 
SECURITY DEFINER 
AS $$
DECLARE
    item_record RECORD;
BEGIN
  -- A. THE DEDUCTION CASE (Order becomes Delivered + Paid)
  IF (NEW.status = 'Delivered' AND NEW.payment_status = 'Paid') 
     AND NOT (COALESCE(OLD.status, '') = 'Delivered' AND COALESCE(OLD.payment_status, '') = 'Paid') THEN
    
    -- 1. Deduct Stock for all items in this order
    FOR item_record IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
        UPDATE public.products 
        SET quantity = quantity - item_record.quantity 
        WHERE id = item_record.product_id;
    END LOOP;

    -- 2. Record/Update Financial Transaction
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE order_id = NEW.id) THEN
      INSERT INTO public.transactions (order_id, agent_id, amount, agent_earnings, status)
      VALUES (NEW.id, NEW.assigned_to, COALESCE(NEW.total_value, 0), COALESCE(NEW.delivery_cost, 0), 'Paid');
    ELSE
      UPDATE public.transactions 
      SET status = 'Paid',
          amount = COALESCE(NEW.total_value, 0),
          agent_earnings = COALESCE(NEW.delivery_cost, 0)
      WHERE order_id = NEW.id;
    END IF;

    -- 3. Log the event
    INSERT INTO public.logs (action, entity_type, entity_id, details)
    VALUES ('ORDER_FINALIZED', 'Order', NEW.id, jsonb_build_object('status', NEW.status, 'payment', NEW.payment_status));

  END IF;

  -- B. THE RESTORATION CASE (Order was Delivered + Paid, but now isn't)
  IF (COALESCE(OLD.status, '') = 'Delivered' AND COALESCE(OLD.payment_status, '') = 'Paid') 
     AND NOT (NEW.status = 'Delivered' AND NEW.payment_status = 'Paid') THEN
    
    -- 1. Restore Stock
    FOR item_record IN SELECT product_id, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
        UPDATE public.products 
        SET quantity = quantity + item_record.quantity 
        WHERE id = item_record.product_id;
    END LOOP;

    -- 2. Cancel Financial Transaction
    UPDATE public.transactions SET status = 'Cancelled' WHERE order_id = NEW.id;

    -- 3. Log the reversal
    INSERT INTO public.logs (action, entity_type, entity_id, details)
    VALUES ('ORDER_REVERSED', 'Order', NEW.id, jsonb_build_object('new_status', NEW.status, 'new_payment', NEW.payment_status));

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. BIND THE ENGINE
CREATE TRIGGER trigger_order_impacts
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION handle_order_impacts();

-- 5. ENSURE RLS COMPLIANCE
-- We need to ensure the service role or authenticated users can trigger these updates
-- but since this is SECURITY DEFINER, it runs with the privileges of the creator (owner).
