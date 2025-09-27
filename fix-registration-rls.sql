-- 修复用户注册RLS权限问题
-- 执行这个SQL脚本来修复用户注册时的权限错误

-- 1. 为users表添加缺失的INSERT策略
-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Allow service account to insert users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to insert own profile" ON public.users;

-- 创建新的INSERT策略 - 允许服务账户(触发器)插入用户
CREATE POLICY "Allow service account to insert users" ON public.users 
    FOR INSERT 
    WITH CHECK (true);

-- 2. 确保触发器函数有正确的权限
-- 重建触发器函数并设置正确的权限
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 使用INSERT ON CONFLICT来避免重复插入
    INSERT INTO public.users (id, name, email, role, balance)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        50.00
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 记录错误但不阻止用户注册
        RAISE WARNING 'Error creating user profile: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. 重建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. 确保正确的权限设置
-- 给触发器函数正确的执行权限
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, anon;

-- 5. 备选方案：如果触发器仍然有问题，允许通过应用层创建用户档案
-- 这个策略允许认证用户为自己创建档案
CREATE POLICY "Allow authenticated users to create own profile" ON public.users 
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- 6. 验证RLS状态
-- 确保RLS已启用
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. 显示当前的users表策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users'
ORDER BY policyname;