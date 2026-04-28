-- ========================================================================================
-- EMERGENCY DIAGNOSTIC & FIX: THE "INVISIBLE ADMIN" BUG
-- ========================================================================================
-- WHY YOUR RLS IS FAILING: Your Supabase user (expressecom704@gmail.com) is authenticated
-- in the system, but your exact ID is MISSING from the `public.users` table with the 
-- role of 'admin'. Because my previous strict SQL policies explicitly checked your ID against 
-- that table, the database mathematically categorized you as an unauthorized ghost user 
-- and violently rejected the insert!

-- STEP 1: FORCE-INJECT YOU AS A MASTER ADMIN INTO THE DATABASE
INSERT INTO public.users (id, name, phone, role)
SELECT id, 'Master Admin', email, 'admin'
FROM auth.users 
WHERE email = 'expressecom704@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- STEP 2: RE-APPLY THE PRECISE STRICT POLICIES (Now that you actually exist natively)
DROP POLICY IF EXISTS "Strict Insert Transactions" ON public.transactions;
CREATE POLICY "Strict Insert Transactions" 
ON public.transactions FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Allows insertion ONLY if you are the assigned agent...
  auth.uid() = agent_id 
  -- OR... if your ID exists in the admin table (which we just fixed above!)
  OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

DROP POLICY IF EXISTS "Strict Update Transactions" ON public.transactions;
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
