
CREATE TABLE public.server_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  flagged_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(server_id, flag_type)
);

ALTER TABLE public.server_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to server_flags"
ON public.server_flags
FOR ALL
USING (true)
WITH CHECK (true);
