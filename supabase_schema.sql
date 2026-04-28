-- Supabase PostgreSQL Schema for Real-Time Stock & Logistics App (ULTIMATE V2)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
  agent_segment TEXT, -- ONLY required if role = 'agent'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Admins can insert and update users" ON public.users FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Table: products
CREATE TABLE public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Table: orders
CREATE TABLE public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- Format: ORD-YYYYMMDD-XXXX
  customer_name TEXT, -- OPTIONAL
  customer_phone TEXT NOT NULL,
  delivery_location TEXT NOT NULL,
  date_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Delivered', 'Not Delivered', 'Returned')),
  payment_status TEXT NOT NULL DEFAULT 'Not Paid' CHECK (payment_status IN ('Paid', 'Not Paid')),
  total_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  delivery_cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders viewable by everyone" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Agents can update assigned orders" ON public.orders FOR UPDATE USING (
  auth.uid() = assigned_to OR EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Admins can insert orders" ON public.orders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Table: order_items
CREATE TABLE public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_time NUMERIC(15, 2) NOT NULL
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items viewable by everyone" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Admins can insert order items" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

-- Table: returns
CREATE TABLE public.returns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('Customer unavailable', 'Wrong address', 'Refused', 'Other')),
  returned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Returns viewable by everyone" ON public.returns FOR SELECT USING (true);
CREATE POLICY "Agents can insert returns" ON public.returns FOR INSERT WITH CHECK (true); -- Agent must be able to insert return reason

-- Table: logs
CREATE TABLE public.logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs viewable by admin" ON public.logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);

----------- TRANSACTIONS & TRIGGERS -----------

-- Auto-generate tracking code
CREATE OR REPLACE FUNCTION generate_order_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_code_trigger
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION generate_order_code();

-- Stock decrease on order item insert
CREATE OR REPLACE FUNCTION decrease_stock_on_order() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET quantity = quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrease_stock
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION decrease_stock_on_order();

-- Log immutable history on stock change
CREATE OR REPLACE FUNCTION log_stock_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.quantity <> NEW.quantity THEN
    INSERT INTO public.logs (action, entity_type, entity_id, details)
    VALUES ('STOCK_UPDATE', 'Product', NEW.id, jsonb_build_object('old_quantity', OLD.quantity, 'new_quantity', NEW.quantity));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_stock
AFTER UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION log_stock_change();

-- Return logic: Increase stock when returned
CREATE OR REPLACE FUNCTION handle_return() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Returned' AND OLD.status <> 'Returned' THEN
    -- Restore Stock
    UPDATE public.products p
    SET quantity = p.quantity + oi.quantity
    FROM public.order_items oi
    WHERE p.id = oi.product_id AND oi.order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_returned
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION handle_return();

-- Enable Supabase Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
