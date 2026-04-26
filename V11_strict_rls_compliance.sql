-- ==============================================================================
-- NAGEO MANAGEMENT - STRICT RLS COMPLIANCE FIX FOR TRANSACTIONS
-- ==============================================================================
-- We are explicitly granting secure INSERT and UPDATE policies so the trigger
-- stops hitting the RLS rejection firewall, while maintaining strict Zero-Trust.

-- 1. Ensure RLS is active (per your strict instructions)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2. Clean slate for policies
DROP POLICY IF EXISTS "Strict Read Access for Transactions" ON public.transactions;
DROP POLICY IF EXISTS "Strict Insert Transactions" ON public.transactions;
DROP POLICY IF EXISTS "Strict Update Transactions" ON public.transactions;

-- 3. SELECT Policy (Agents see own, Admin sees all)
CREATE POLICY "Strict Read Access for Transactions" 
ON public.transactions FOR SELECT 
USING (
  auth.uid() = agent_id 
  OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- 4. INSERT Policy (Core Fix)
-- Grants permission to insert ONLY if the executing user is the Agent receiving the payload OR an established Admin
CREATE POLICY "Strict Insert Transactions" 
ON public.transactions FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = agent_id 
  OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- 5. UPDATE Policy
-- Grants permission to update the transaction (i.e. flipping to 'Cancelled' on reversal) securely
CREATE POLICY "Strict Update Transactions" 
ON public.transactions FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = agent_id 
  OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
) WITH CHECK (
  auth.uid() = agent_id 
  OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- 6. Trigger Engine Redefinition
CREATE OR REPLACE FUNCTION handle_financial_transaction() RETURNS TRIGGER 
SECURITY DEFINER 
AS $$
BEGIN
  -- Execute the financial logging calculations
  IF NEW.status = 'Delivered' AND NEW.payment_status = 'Paid' THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE order_id = NEW.id) THEN
      INSERT INTO public.transactions (order_id, agent_id, amount, agent_earnings, status)
      VALUES (NEW.id, NEW.assigned_to, COALESCE(NEW.total_value, 0) + COALESCE(NEW.delivery_cost, 0), COALESCE(NEW.delivery_cost, 0), 'Paid');
    ELSE
      UPDATE public.transactions 
      SET status = 'Paid',
          amount = COALESCE(NEW.total_value, 0) + COALESCE(NEW.delivery_cost, 0),
          agent_earnings = COALESCE(NEW.delivery_cost, 0)
      WHERE order_id = NEW.id;
    END IF;
  END IF;

  -- Maintain reversal tracking
  IF NEW.status <> 'Delivered' OR NEW.payment_status <> 'Paid' THEN
    UPDATE public.transactions SET status = 'Cancelled' WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_financial_transaction ON public.orders;
CREATE TRIGGER trigger_financial_transaction
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION handle_financial_transaction();
