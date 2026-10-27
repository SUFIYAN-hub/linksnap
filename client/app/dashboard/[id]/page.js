'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../lib/api';

// Small reusable card for the ranked lists (referrers, countries)
function RankedList({ title, items }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="bg-white p-5 rounded-xl shadow">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {items.length === 0 && <p className="text-sm text-gray-500">No data yet</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.name}>
            <div className="flex justify-between text-sm text-gray-800">
              <span className="truncate">{item.name}</span>
              <span className="font-medium">{item.count}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded mt-1">
              <div
                className="h-1.5 bg-blue-600 rounded"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Reusable bar chart card (devices, browsers)
function BarCard({ title, data }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">No data yet</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  // Refetch whenever the link or the time range changes
  useEffect(() => {
    if (!user) return;
    setError('');
    api
      .get(`/api/links/${id}/analytics?days=${days}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load analytics'));
  }, [user, id, days]);

  if (loading || !user) return <p className="p-8">Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Link href="/dashboard" className="text-sm text-blue-600 underline">
          &larr; Back to dashboard
        </Link>

        {error && <p className="text-red-600">{error}</p>}
        {!data && !error && <p>Loading analytics...</p>}

        {data && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">/{data.link.shortCode}</h1>
                <p className="text-sm text-gray-500 truncate">{data.link.originalUrl}</p>
                <p className="mt-1 text-gray-800">
                  <strong>{data.link.totalClicks}</strong> total clicks
                </p>
              </div>

              <div className="flex gap-2">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`text-sm px-3 py-1.5 rounded-lg border ${
                      days === d ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
                    }`}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>

            {/* Clicks over time */}
            <div className="bg-white p-5 rounded-xl shadow">
              <h3 className="font-semibold text-gray-900 mb-3">Clicks over time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.clicksOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="clicks" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <BarCard title="Devices" data={data.devices} />
              <BarCard title="Browsers" data={data.browsers} />
              <RankedList title="Top referrers" items={data.referrers} />
              <RankedList title="Top countries" items={data.countries} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}