-- ==============================================================================
-- SECURE ROLE-LEVEL SECURITY IMPLEMENTATION FOR TRANSACTIONS LEDGER
-- ==============================================================================

-- 1. ENFORCE STRICT RLS ON TRANSACTIONS (Re-enabling Security)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2. PURGE ALL INSECURE OR TEMPORARY POLICIES
DROP POLICY IF EXISTS "Agents can see own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow system to insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow system to update transactions" ON public.transactions;

-- 3. SELECT POLICY: Strict Read-Only Access
-- Admins can query all transactions. Agents can only query records where their UUID matches the agent_id.
CREATE POLICY "Strict Read Access for Transactions" 
ON public.transactions FOR SELECT 
USING (
  auth.uid() = agent_id 
  OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- ==============================================================================
-- NOTE: We explicitly DO NOT create INSERT, UPDATE, or DELETE policies!
-- ==============================================================================
-- If we created a policy allowing users to INSERT transactions, malicious actors 
-- could theoretically inject fake financial numbers using the public API keys.
-- Instead, we securely delegate INSERT/UPDATE operations strictly to the PostgreSQL
-- Backend Trigger running with Admin-level privileges.


-- 4. SECURE BACKEND SYSTEM INSERTS (Trigger Redefinition)
-- By defining the trigger with "SECURITY DEFINER", we instruct PostgreSQL to execute
-- this specific function using elevated system permissions. It can write to the 
-- transactions table without exposing raw INSERT access to the frontend/users.

CREATE OR REPLACE FUNCTION handle_financial_transaction() RETURNS TRIGGER 
SECURITY DEFINER -- <-- This safely runs the function bypassing user-level RLS restrictions
AS $$
BEGIN
  -- When the order correctly transitions INTO a fully Paid state
  IF NEW.payment_status = 'Paid' AND OLD.payment_status = 'Not Paid' THEN
    IF EXISTS (SELECT 1 FROM public.transactions WHERE order_id = NEW.id) THEN
      UPDATE public.transactions SET status = 'Paid' WHERE order_id = NEW.id;
    ELSE
      INSERT INTO public.transactions (order_id, agent_id, amount, agent_earnings, status)
      VALUES (NEW.id, NEW.assigned_to, COALESCE(NEW.total_value, 0) + COALESCE(NEW.delivery_cost, 0), COALESCE(NEW.delivery_cost, 0), 'Paid');
    END IF;
  END IF;

  -- When the order transitions OUT OF Paid state (Reversal Logic)
  IF NEW.payment_status = 'Not Paid' AND OLD.payment_status = 'Paid' THEN
    UPDATE public.transactions SET status = 'Cancelled' WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. RE-BIND THE SECURE TRIGGER
DROP TRIGGER IF EXISTS trigger_financial_transaction ON public.orders;
CREATE TRIGGER trigger_financial_transaction
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION handle_financial_transaction();
