
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.current_user_email() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.am_i_student() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.leaderboard() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_student_stats() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_announcements_updated_at() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.am_i_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_student_stats() TO authenticated;
