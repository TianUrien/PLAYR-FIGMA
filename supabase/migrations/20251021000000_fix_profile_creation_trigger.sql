-- Fix profiles table for 2-step signup flow
-- 1. Remove NOT NULL constraints that prevent DB trigger from creating basic profile
-- 2. Add trigger to create profile automatically when user signs up

-- Step 1: Make fields optional (except id, email, role)
ALTER TABLE public.profiles 
  ALTER COLUMN full_name DROP NOT NULL,
  ALTER COLUMN base_location DROP NOT NULL,
  ALTER COLUMN nationality DROP NOT NULL;

-- Step 2: Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'player'),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
'Automatically creates a basic profile when a new user signs up. Profile is completed after email verification.';

