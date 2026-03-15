-- Aja nämä komennot Supabasen SQL Editorissa (Dashboard -> SQL Editor -> New Query)
-- Tämä luo tietokantataulun tallennetuille työvuoroille.

-- 1. Luo taulu vuoroille
CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL,
    date timestamp with time zone NOT NULL,
    start_input text NOT NULL,
    end_input text NOT NULL,
    break_start_str text,
    break_end_str text,
    total_minutes integer,
    paid_minutes integer,
    normal_minutes integer,
    normal_pay numeric,
    overtime50_minutes integer,
    ot50_pay numeric,
    overtime100_minutes integer,
    ot100_pay numeric,
    evening_minutes integer,
    evening_pay numeric,
    night_minutes integer,
    night_pay numeric,
    saturday_minutes integer,  -- UUSI: AKT 2025-2026 lauantailisä
    saturday_pay numeric,      -- UUSI: AKT 2025-2026 lauantailisä
    sunday_minutes integer,
    sunday_pay numeric,
    total_pay numeric,
    experience_level text,     -- UUSI: Tallennettu kokemusvuositaso
    base_wage numeric,         -- UUSI: Tallennettu tuntipalkka
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Kytke Row Level Security (RLS) päälle tietoturvan vuoksi
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- 3. Salli käyttäjien nähdä vvain omat vuoronsa
CREATE POLICY "Users can view their own shifts" 
ON public.shifts FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Salli käyttäjien lisätä omia vuorojaan
CREATE POLICY "Users can insert their own shifts" 
ON public.shifts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 5. Salli käyttäjien päivittää omia vuorojaan
CREATE POLICY "Users can update their own shifts" 
ON public.shifts FOR UPDATE 
USING (auth.uid() = user_id);

-- 6. Salli käyttäjien poistaa omia vuorojaan
CREATE POLICY "Users can delete their own shifts" 
ON public.shifts FOR DELETE 
USING (auth.uid() = user_id);
