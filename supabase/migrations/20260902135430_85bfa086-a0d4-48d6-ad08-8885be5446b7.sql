REVOKE EXECUTE ON FUNCTION public.has_plus(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_plus() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leaderboard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_class_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_student_limit() FROM PUBLIC, anon, authenticated;