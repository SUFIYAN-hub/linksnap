'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [links, setLinks] = useState([]);
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Not logged in -> go to login (only after the /me check has finished)
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  // Fetch this user's links once we know who they are
  useEffect(() => {
    if (!user) return;
    api
      .get('/api/links')
      .then((res) => setLinks(res.data.links))
      .catch(() => setError('Could not load your links'));
  }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body = { originalUrl };
      if (customAlias.trim()) body.customAlias = customAlias.trim();
      const res = await api.post('/api/links', body);
      // Put the new link at the top without refetching everything
      setLinks((prev) => [res.data.link, ...prev]);
      setOriginalUrl('');
      setCustomAlias('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (link) => {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  if (loading || !user) return <p className="p-8">Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">LinkSnap</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.name}</span>
            <button onClick={logout} className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded-lg">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Create form */}
        <form onSubmit={handleCreate} className="bg-white p-5 rounded-xl shadow space-y-3">
          <h2 className="font-semibold text-gray-900">Shorten a link</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input
            type="url"
            placeholder="https://example.com/a/very/long/url"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-gray-900"
          />
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Custom alias (optional)"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-gray-900"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white rounded-lg px-5 py-2 font-medium disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Shorten'}
            </button>
          </div>
        </form>

        {/* Links list */}
        <section className="space-y-3">
          <h2 className="font-semibold text-gray-900">Your links ({links.length})</h2>

          {links.length === 0 && (
            <p className="text-sm text-gray-500">No links yet. Create your first one above.</p>
          )}

          {links.map((link) => (
            <div key={link.id} className="bg-white p-4 rounded-xl shadow flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-blue-600 truncate">{link.shortUrl}</p>
                <p className="text-sm text-gray-500 truncate">{link.originalUrl}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-gray-700">
                  <strong>{link.clickCount}</strong> clicks
                </span>
                <button
                  onClick={() => handleCopy(link)}
                  className="text-sm border rounded-lg px-3 py-1.5 text-gray-800"
                >
                  {copiedId === link.id ? 'Copied!' : 'Copy'}
                </button>
                <Link
                  href={`/dashboard/${link.id}`}
                  className="text-sm bg-gray-800 text-white rounded-lg px-3 py-1.5"
                >
                  Analytics
                </Link>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}