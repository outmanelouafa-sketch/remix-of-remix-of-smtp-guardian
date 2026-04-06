
-- Users table for custom auth
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('boss', 'server_manager', 'smtp_manager')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Seed users
INSERT INTO public.users (name, email, password, role) VALUES
  ('Outmane', 'outmanel@manager.com', 'outmane@124019', 'server_manager'),
  ('Abdellatif', 'abdellatif@manager.com', 'abdellatif@124019', 'boss'),
  ('Aicha', 'aicha@manager.com', 'aicha@124019', 'smtp_manager');

-- Servers table
CREATE TABLE public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ids TEXT NOT NULL,
  ip_main TEXT,
  domain TEXT,
  provider TEXT,
  rdns TEXT,
  score TEXT,
  d_pro DATE,
  n_due DATE,
  username TEXT,
  password TEXT,
  email TEXT,
  passwd TEXT,
  price TEXT,
  section TEXT NOT NULL DEFAULT 'production' CHECK (section IN ('production', 'redirect', 'suspended')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to servers" ON public.servers FOR ALL USING (true) WITH CHECK (true);

-- SMTP Status table
CREATE TABLE public.smtp_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('BL', 'SH', 'BR', 'TO', 'EXP', 'ECR', 'CLEAN')),
  note TEXT,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(server_id, date)
);

ALTER TABLE public.smtp_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to smtp_status" ON public.smtp_status FOR ALL USING (true) WITH CHECK (true);

-- Delistings table
CREATE TABLE public.delistings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  blacklist_type TEXT NOT NULL CHECK (blacklist_type IN ('BL', 'SH', 'BR')),
  submitted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.delistings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to delistings" ON public.delistings FOR ALL USING (true) WITH CHECK (true);

-- Activity log table
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  server_ids TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access to activity_log" ON public.activity_log FOR ALL USING (true) WITH CHECK (true);
