/**
 * Administrator-only account operations.
 *
 * Creating, deleting and resetting passwords for other users requires Supabase's
 * service role key, which must never reach the browser. This function holds it
 * server-side and only acts after confirming the caller is an administrator.
 *
 * Required environment variables (set with `vercel env add`):
 *   SUPABASE_URL                — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   — the `service_role` key, secret
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface CreateHeadBody {
  action: 'create';
  email: string;
  password: string;
  fullName?: string;
  wardId?: string | null;
}

interface DeleteUserBody {
  action: 'delete';
  userId: string;
}

interface ResetPasswordBody {
  action: 'reset-password';
  userId: string;
  password: string;
}

type Body = CreateHeadBody | DeleteUserBody | ResetPasswordBody;

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** Rejects unless the bearer token belongs to a signed-in administrator. */
async function requireAdmin(request: Request, admin: SupabaseClient): Promise<Response | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return json(401, { error: 'Missing bearer token.' });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'Invalid or expired session.' });

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profileError) return json(500, { error: 'Could not read the caller profile.' });
  if (profile?.role !== 'admin') return json(403, { error: 'Administrator access is required.' });

  return null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Use POST.' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json(503, {
      error:
        'Account management is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        'on the deployment, then redeploy.',
    });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const denied = await requireAdmin(request, admin);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(400, { error: 'Expected a JSON body.' });
  }

  switch (body.action) {
    case 'create': {
      const email = (body.email ?? '').trim().toLowerCase();
      if (!email || !body.password) return json(400, { error: 'Email and password are required.' });
      if (body.password.length < 8) return json(400, { error: 'Password must be at least 8 characters.' });

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true, // no confirmation mail: the admin hands over the password
        user_metadata: { full_name: body.fullName ?? '', must_change_password: true },
      });

      if (error) return json(400, { error: error.message });
      const userId = data.user!.id;

      // The on_auth_user_created trigger has already inserted the profile.
      if (body.fullName) {
        await admin.from('profiles').update({ full_name: body.fullName }).eq('id', userId);
      }
      if (body.wardId) {
        const { error: wardError } = await admin.from('wards').update({ head_id: userId }).eq('id', body.wardId);
        if (wardError) return json(400, { error: `Account created, but assigning the ward failed: ${wardError.message}` });
      }

      return json(200, { id: userId, email });
    }

    case 'delete': {
      if (!body.userId) return json(400, { error: 'userId is required.' });
      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true });
    }

    case 'reset-password': {
      if (!body.userId || !body.password) return json(400, { error: 'userId and password are required.' });
      if (body.password.length < 8) return json(400, { error: 'Password must be at least 8 characters.' });

      const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
      if (error) return json(400, { error: error.message });

      await admin.from('profiles').update({ must_change_password: true }).eq('id', body.userId);
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: 'Unknown action.' });
  }
}
