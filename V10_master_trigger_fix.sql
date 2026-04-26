-- ==============================================================================
-- NAGEO MANAGEMENT - MASTER FINANCIAL ENGINE FIX
-- ==============================================================================

-- 1. DROP OLD RESTRICTIVE TRIGGER
DROP TRIGGER IF EXISTS trigger_financial_transaction ON public.orders;

-- 2. CREATE A BULLETPROOF TRIGGER FUNCTION (SECURITY DEFINER)
-- This natively evaluates ANY change on the order. If the final state is Delivered + Paid,
-- it forces the Ledger sequence regardless of which order the buttons were pressed in!
CREATE OR REPLACE FUNCTION handle_financial_transaction() RETURNS TRIGGER 
SECURITY DEFINER 
AS $$
BEGIN
  -- Re-evaluate the total ledger criteria on ANY update to ensure synchronization
  IF NEW.status = 'Delivered' AND NEW.payment_status = 'Paid' THEN
    -- If it doesn't exist, Create it
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE order_id = NEW.id) THEN
      INSERT INTO public.transactions (order_id, agent_id, amount, agent_earnings, status)
      VALUES (
        NEW.id, 
        NEW.assigned_to, 
        COALESCE(NEW.total_value, 0) + COALESCE(NEW.delivery_cost, 0), 
        COALESCE(NEW.delivery_cost, 0), 
        'Paid'
      );
    ELSE
      -- If it exists but is Cancelled, flip it back to Paid and ensure math is still accurate
      UPDATE public.transactions 
      SET status = 'Paid',
          amount = COALESCE(NEW.total_value, 0) + COALESCE(NEW.delivery_cost, 0),
          agent_earnings = COALESCE(NEW.delivery_cost, 0)
      WHERE order_id = NEW.id;
    END IF;
  END IF;

  -- REVERSAL HANDLING: If either Delivered or Paid is unset!
  IF NEW.status <> 'Delivered' OR NEW.payment_status <> 'Paid' THEN
    -- Strictly mark Cancelled to maintain audit integrity
    UPDATE public.transactions SET status = 'Cancelled' WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. REBIND TRIGGER TO ALL UPDATES
CREATE TRIGGER trigger_financial_transaction
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION handle_financial_transaction();
