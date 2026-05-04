import { getUser, signOut } from '@/actions/auth.actions';

export default async function DashboardPage() {
  const user = await getUser();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      <p className="text-gray-600">
        Connecté en tant que <span className="font-medium">{user?.email}</span>.
      </p>
    </main>
  );
}
