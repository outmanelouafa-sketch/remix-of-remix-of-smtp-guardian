
-- Server-SMTP Manager Assignments table
CREATE TABLE public.server_smtp_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  smtp_manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(server_id, smtp_manager_id)
);

ALTER TABLE public.server_smtp_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to server_smtp_assignments"
ON public.server_smtp_assignments
FOR ALL
USING (true)
WITH CHECK (true);
