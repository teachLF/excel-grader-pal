ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_plus boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plus_requested boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.has_plus(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_plus FROM public.profiles WHERE id = _user_id), false)
      OR public.has_role(_user_id, 'admin'::app_role)
$$;
GRANT EXECUTE ON FUNCTION public.has_plus(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_plus()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.profiles SET plus_requested = true WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.request_plus() TO authenticated;

-- Grant plus to the admin account
UPDATE public.profiles p SET is_plus = true, approved = true
FROM auth.users u
WHERE u.id = p.id AND lower(u.email) = 's3904844@mkhb.moe.gov.sa';

-- Limits: 2 classes / 25 students per class for non-plus users
CREATE OR REPLACE FUNCTION public.enforce_class_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE cnt integer;
BEGIN
  IF public.has_plus(NEW.user_id) THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM public.classes WHERE user_id = NEW.user_id;
  IF cnt >= 2 THEN
    RAISE EXCEPTION 'الحد الأقصى للفصول هو 2. اشترك في Plus لفصول غير محدودة.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS classes_limit_trigger ON public.classes;
CREATE TRIGGER classes_limit_trigger BEFORE INSERT ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.enforce_class_limit();

CREATE OR REPLACE FUNCTION public.enforce_student_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE cnt integer;
BEGIN
  IF public.has_plus(NEW.user_id) THEN RETURN NEW; END IF;
  SELECT count(*) INTO cnt FROM public.students WHERE class_id = NEW.class_id;
  IF cnt > 25 THEN
    RAISE EXCEPTION 'الحد الأقصى للطلاب في الفصل هو 25. اشترك في Plus.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS students_limit_trigger ON public.students;
CREATE TRIGGER students_limit_trigger AFTER INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_limit();

-- Class-scoped leaderboard
CREATE OR REPLACE FUNCTION public.leaderboard()
RETURNS TABLE(rank bigint, display_name text, total_points bigint, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (SELECT lower(COALESCE(public.current_user_email(),'')) AS email),
  my_classes AS (
    SELECT s.class_id FROM public.students s, me WHERE lower(s.student_email) = me.email
  ),
  scope AS (
    SELECT s.* FROM public.students s
    WHERE
      CASE
        WHEN EXISTS (SELECT 1 FROM my_classes) THEN s.class_id IN (SELECT class_id FROM my_classes)
        WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN true
        ELSE s.user_id = auth.uid()
      END
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(public.event_points(e.event_type)),0) DESC, s.name) AS rank,
    s.name AS display_name,
    COALESCE(SUM(public.event_points(e.event_type)),0)::BIGINT AS total_points,
    lower(COALESCE(s.student_email,'')) = (SELECT email FROM me) AS is_me
  FROM scope s
  LEFT JOIN public.student_events e ON e.student_id = s.id
  GROUP BY s.id, s.name, s.student_email
  ORDER BY total_points DESC, s.name
$$;
GRANT EXECUTE ON FUNCTION public.leaderboard() TO authenticated;

-- Storage policies for announcement media
CREATE POLICY "authenticated read announcement media" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'announcements');
CREATE POLICY "admins upload announcement media" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins update announcement media" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins delete announcement media" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'announcements' AND public.has_role(auth.uid(), 'admin'::app_role));