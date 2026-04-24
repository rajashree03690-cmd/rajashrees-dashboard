-- Create app_settings table if it doesn't exist (it seems the Dashboard UI was built for it but table was never created)
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    app_name TEXT NOT NULL DEFAULT 'Rajashree Fashion',
    logo_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    currency TEXT NOT NULL DEFAULT 'INR',
    maintenance_mode BOOLEAN DEFAULT false,
    maintenance_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default row if the table is empty
INSERT INTO public.app_settings (app_name, timezone, currency, maintenance_mode)
SELECT 'Rajashree Fashion', 'Asia/Kolkata', 'INR', false
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- Set up Row Level Security (RLS)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for the storefront to check maintenance mode)
CREATE POLICY "Allow public read access on app_settings"
    ON public.app_settings FOR SELECT
    USING (true);

-- Allow authenticated users to update (for dashboard admins)
CREATE POLICY "Allow authenticated update on app_settings"
    ON public.app_settings FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert (if table is empty and they are setting it up)
CREATE POLICY "Allow authenticated insert on app_settings"
    ON public.app_settings FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_settings_timestamp ON public.app_settings;
CREATE TRIGGER update_app_settings_timestamp
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_app_settings_updated_at();

-- Explicitly grant SELECT to anon role so the middleware can read the maintenance status
GRANT SELECT ON public.app_settings TO anon;
