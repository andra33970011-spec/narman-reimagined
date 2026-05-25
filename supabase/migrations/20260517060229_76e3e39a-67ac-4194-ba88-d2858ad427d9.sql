
DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'narman208@gmail.com';

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
      'narman208@gmail.com', crypt('Poogalampa97', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nama_lengkap":"Super Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _uid, jsonb_build_object('sub', _uid::text, 'email', 'narman208@gmail.com'), 'email', _uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt('Poogalampa97', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = _uid;
  END IF;

  INSERT INTO public.profiles (id, nama_lengkap)
  VALUES (_uid, 'Super Admin')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'super_admin')
  ON CONFLICT DO NOTHING;
END $$;
