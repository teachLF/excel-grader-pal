CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.profiles;
  em text := lower(COALESCE(public.current_user_email(), ''));
  is_admin_email boolean := em = 's3904844@mkhb.moe.gov.sa';
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.profiles (id, email, approved, is_plus)
  VALUES (auth.uid(), public.current_user_email(), is_admin_email, is_admin_email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        approved = public.profiles.approved OR is_admin_email,
        is_plus = public.profiles.is_plus OR is_admin_email
  RETURNING * INTO p;

  IF is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN p;
END;
$function$;