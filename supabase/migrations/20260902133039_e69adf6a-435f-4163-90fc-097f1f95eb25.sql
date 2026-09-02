
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  student_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_events TO authenticated;
GRANT ALL ON public.student_events TO service_role;
ALTER TABLE public.student_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_notes TO authenticated;
GRANT ALL ON public.student_notes TO service_role;
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('video','image')),
  media_url TEXT NOT NULL,
  skip_delay_seconds INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE INDEX announcements_is_active_idx ON public.announcements(is_active);
CREATE INDEX announcements_created_at_idx ON public.announcements(created_at DESC);
CREATE INDEX students_class_id_idx ON public.students(class_id);
CREATE INDEX student_events_student_id_idx ON public.student_events(student_id);

-- helper functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT approved FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.am_i_student()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE lower(s.student_email) = lower(public.current_user_email())
  )
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (auth.uid(), public.current_user_email())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  RETURNING * INTO p;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_points(_event_type TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _event_type
    WHEN 'star' THEN 5
    WHEN 'present' THEN 1
    WHEN 'absent' THEN 0
    WHEN 'escaped' THEN -2
    WHEN 'misbehaving' THEN -2
    WHEN 'sleeping' THEN -1
    WHEN 'talking' THEN -1
    ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS TABLE (rank BIGINT, display_name TEXT, total_points BIGINT, is_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(public.event_points(e.event_type)),0) DESC, s.name) AS rank,
    s.name AS display_name,
    COALESCE(SUM(public.event_points(e.event_type)),0)::BIGINT AS total_points,
    lower(COALESCE(s.student_email,'')) = lower(COALESCE(public.current_user_email(),'')) AS is_me
  FROM public.students s
  LEFT JOIN public.student_events e ON e.student_id = s.id
  GROUP BY s.id, s.name, s.student_email
  ORDER BY total_points DESC, s.name
$$;

CREATE OR REPLACE FUNCTION public.my_student_stats()
RETURNS TABLE (
  student_name TEXT,
  total_points BIGINT,
  star_count BIGINT,
  present_count BIGINT,
  absent_count BIGINT,
  escaped_count BIGINT,
  misbehaving_count BIGINT,
  sleeping_count BIGINT,
  talking_count BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.name,
    COALESCE(SUM(public.event_points(e.event_type)),0)::BIGINT,
    COUNT(*) FILTER (WHERE e.event_type = 'star')::BIGINT,
    COUNT(*) FILTER (WHERE e.event_type = 'present')::BIGINT,
    COUNT(*) FILTER (WHERE e.event_type = 'absent')::BIGINT,
    COUNT(*) FILTER (WHERE e.event_type = 'escaped')::BIGINT,
    COUNT(*) FILTER (WHERE e.event_type = 'misbehaving')::BIGINT,
    COUNT(*) FILTER (WHERE e.event_type = 'sleeping')::BIGINT,
    COUNT(*) FILTER (WHERE e.event_type = 'talking')::BIGINT
  FROM public.students s
  LEFT JOIN public.student_events e ON e.student_id = s.id
  WHERE lower(s.student_email) = lower(public.current_user_email())
  GROUP BY s.id, s.name
  LIMIT 1
$$;

-- policies
CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "teachers manage own classes" ON public.classes FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "teachers manage own students" ON public.students FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "students read own row" ON public.students FOR SELECT TO authenticated
  USING (lower(student_email) = lower(public.current_user_email()));

CREATE POLICY "teachers manage own events" ON public.student_events FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "students read own events" ON public.student_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id
    AND lower(s.student_email) = lower(public.current_user_email())));

CREATE POLICY "teachers manage own notes" ON public.student_notes FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "anyone views active announcements" ON public.announcements FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.update_announcements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER announcements_updated_at_trigger BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.update_announcements_updated_at();
