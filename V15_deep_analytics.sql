-- V15: Deep Analytics & Performance Tracking Engine
-- Run this in Supabase SQL Editor to enable persistent reporting

-- 1. Table to track product performance (real sales vs revenue)
CREATE TABLE IF NOT EXISTS public.product_performance_stats (
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE PRIMARY KEY,
    total_units_sold INTEGER DEFAULT 0,
    total_revenue NUMERIC(15, 2) DEFAULT 0.00,
    last_sale_date TIMESTAMP WITH TIME ZONE,
    average_sale_price NUMERIC(15, 2) DEFAULT 0.00
);

-- 2. Trigger Function to update stats automatically on finalized orders
CREATE OR REPLACE FUNCTION update_performance_engine() RETURNS TRIGGER 
SECURITY DEFINER AS $$
BEGIN
    -- Only trigger when order is marked Delivered AND Paid
    IF (NEW.status = 'Delivered' AND NEW.payment_status = 'Paid') AND 
       (OLD.status <> 'Delivered' OR OLD.payment_status <> 'Paid') THEN
        
        -- Update stats for each item in the order
        INSERT INTO public.product_performance_stats (product_id, total_units_sold, total_revenue, last_sale_date)
        SELECT 
            oi.product_id, 
            oi.quantity, 
            (oi.quantity * oi.price_at_time),
            NOW()
        FROM public.order_items oi
        WHERE oi.order_id = NEW.id
        ON CONFLICT (product_id) DO UPDATE SET
            total_units_sold = product_performance_stats.total_units_sold + EXCLUDED.total_units_sold,
            total_revenue = product_performance_stats.total_revenue + EXCLUDED.total_revenue,
            last_sale_date = EXCLUDED.last_sale_date;
            
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Bind the engine
DROP TRIGGER IF EXISTS trigger_update_performance ON public.orders;
CREATE TRIGGER trigger_update_performance
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_performance_engine();

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_performance_stats;
