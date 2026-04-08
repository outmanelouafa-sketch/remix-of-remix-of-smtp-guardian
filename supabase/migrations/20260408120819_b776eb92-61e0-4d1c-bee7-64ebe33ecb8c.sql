
CREATE TABLE public.provider_urls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name text NOT NULL UNIQUE,
  url text NOT NULL,
  added_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to provider_urls"
ON public.provider_urls
FOR ALL
USING (true)
WITH CHECK (true);
