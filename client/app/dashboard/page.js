'use client';

import { useAuth } from '../../context/AuthContext';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();

  if (loading) return <p className="p-8">Loading...</p>;
  if (!user) return <p className="p-8">Not logged in. Go to /login</p>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
      <button onClick={logout} className="mt-4 bg-gray-800 text-white px-4 py-2 rounded-lg">
        Log out
      </button>
    </main>
  );
}