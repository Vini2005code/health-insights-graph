
CREATE TABLE public.dashboard_charts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  chart_type TEXT NOT NULL,
  chart_data JSONB NOT NULL,
  x_key TEXT NOT NULL,
  y_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard charts"
ON public.dashboard_charts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard charts"
ON public.dashboard_charts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard charts"
ON public.dashboard_charts FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard charts"
ON public.dashboard_charts FOR UPDATE
USING (auth.uid() = user_id);
