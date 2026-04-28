-- Create the transactions ledger
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  agent_earnings NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid', 'Cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Agents can only see their own transactions
CREATE POLICY "Agents can see own transactions" ON public.transactions FOR SELECT USING (
  auth.uid() = agent_id OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Realtime enablement
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- The Financial Trigger Logic
CREATE OR REPLACE FUNCTION handle_financial_transaction() RETURNS TRIGGER AS $$
BEGIN
  -- When the order correctly transitions INTO a fully Paid state
  IF NEW.payment_status = 'Paid' AND OLD.payment_status = 'Not Paid' THEN
    IF EXISTS (SELECT 1 FROM public.transactions WHERE order_id = NEW.id) THEN
      -- Flip back to Paid if it was previously reversed
      UPDATE public.transactions SET status = 'Paid' WHERE order_id = NEW.id;
    ELSE
      -- Insert a secure, immutable ledger entry mapping the total revenue and the driver's cut
      INSERT INTO public.transactions (order_id, agent_id, amount, agent_earnings, status)
      VALUES (NEW.id, NEW.assigned_to, COALESCE(NEW.total_value, 0) + COALESCE(NEW.delivery_cost, 0), COALESCE(NEW.delivery_cost, 0), 'Paid');
    END IF;
  END IF;

  -- When the order transitions OUT OF Paid state (Reversal Logic)
  IF NEW.payment_status = 'Not Paid' AND OLD.payment_status = 'Paid' THEN
    -- Strictly mark Cancelled to maintain financial tracking integrity
    UPDATE public.transactions SET status = 'Cancelled' WHERE order_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind the accounting engine
DROP TRIGGER IF EXISTS trigger_financial_transaction ON public.orders;
CREATE TRIGGER trigger_financial_transaction
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION handle_financial_transaction();
