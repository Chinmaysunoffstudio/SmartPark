-- Supabase Schema for Parking Management System
-- Fully Idempotent (IF NOT EXISTS + DROP/CREATE logic)

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Locations Table
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  total_slots INTEGER DEFAULT 0,
  levels JSONB DEFAULT '[]'::jsonb,
  admin_id UUID REFERENCES public.profiles(uid) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Slots Table
CREATE TABLE IF NOT EXISTS public.slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  slot_number TEXT NOT NULL,
  level TEXT,
  section TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  type TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(uid) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES public.slots(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  qr_data TEXT UNIQUE,
  scanned_in_at TIMESTAMPTZ,
  scanned_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- REFRESH POLICIES (DROP First to avoid duplicates)
DO $$
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Profiles are readable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

    -- Locations
    DROP POLICY IF EXISTS "Locations readable by everyone" ON public.locations;
    DROP POLICY IF EXISTS "Anyone can insert locations" ON public.locations;
    DROP POLICY IF EXISTS "Admins can manage any location" ON public.locations;
    DROP POLICY IF EXISTS "Allow select for all" ON public.locations;
    DROP POLICY IF EXISTS "Allow insert for all" ON public.locations;
    DROP POLICY IF EXISTS "Allow admin all" ON public.locations;

    -- Slots
    DROP POLICY IF EXISTS "Slots readable by everyone" ON public.slots;
    DROP POLICY IF EXISTS "Anyone can insert slots" ON public.slots;
    DROP POLICY IF EXISTS "Anyone can update slot availability" ON public.slots;
    DROP POLICY IF EXISTS "Allow slots select for all" ON public.slots;
    DROP POLICY IF EXISTS "Allow slots insert for all" ON public.slots;
    DROP POLICY IF EXISTS "Allow slots admin all" ON public.slots;
    DROP POLICY IF EXISTS "Users can update slot availability" ON public.slots;

    -- Bookings
    DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Admins can manage bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
END $$;

-- APPLY POLICIES

-- Profiles
CREATE POLICY "Profiles are readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = uid);

-- Locations
CREATE POLICY "Locations readable by everyone" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage any location" ON public.locations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE uid = auth.uid() AND role = 'admin')
);

-- Slots
CREATE POLICY "Slots readable by everyone" ON public.slots FOR SELECT USING (true);
CREATE POLICY "Anyone can insert slots" ON public.slots FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update slot availability" ON public.slots FOR UPDATE USING (true);

-- Bookings
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE uid = auth.uid() AND role = 'admin'));
CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage bookings" ON public.bookings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE uid = auth.uid() AND role = 'admin'));


-- SEED DATA (Idempotent)
INSERT INTO public.locations (id, name, address, lat, lng, total_slots, levels) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Phoenix Marketcity', 'Viman Nagar, Pune', 18.5622, 73.9167, 300, '["B1", "B2", "L1"]'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Amanora Mall', 'Hadapsar, Pune', 18.5186, 73.9341, 400, '["L1", "L2", "L3", "L4"]'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Seasons Mall', 'Magarpatta, Pune', 18.5198, 73.9312, 300, '["B1", "B2", "L1"]'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Pavillion Mall', 'Senapati Bapat Rd, Pune', 18.5348, 73.8291, 200, '["B1", "B2"]'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Westend Mall', 'Aundh, Pune', 18.5601, 73.8031, 200, '["B1", "L1"]')
ON CONFLICT (id) DO NOTHING;

-- Seed slots
INSERT INTO public.slots (location_id, slot_number, level, section, is_available)
SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'B1-A' || lpad(i::text, 2, '0'), 'B1', 'A', true FROM generate_series(1, 10) i
ON CONFLICT DO NOTHING;

INSERT INTO public.slots (location_id, slot_number, level, section, is_available)
SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'L1-B' || lpad(i::text, 2, '0'), 'L1', 'B', true FROM generate_series(1, 10) i
ON CONFLICT DO NOTHING;

