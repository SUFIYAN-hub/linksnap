'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

const features = [
  { title: 'Short links', text: 'Turn long URLs into short ones, with an optional custom alias.' },
  { title: 'Fast redirects', text: 'Popular links are cached in Redis, so redirects stay quick.' },
  { title: 'Click analytics', text: 'See clicks over time, devices, browsers, referrers and countries.' },
  { title: 'Link expiration', text: 'Disable a link automatically after some days or a number of clicks.' },
  { title: 'QR codes', text: 'Every link gets a QR code you can view and download.' },
  { title: 'Private dashboard', text: 'Log in to see and manage only your own links.' },
];

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">LinkSnap</span>
          <nav className="flex items-center gap-2 sm:gap-3">
            {loading ? null : user ? (
              <Link href="/dashboard" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-700 px-3 py-2">
                  Log in
                </Link>
                <Link href="/signup" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
          Shorten links. <span className="text-blue-600">Track every click.</span>
        </h1>
        <p className="mt-5 text-base sm:text-lg text-gray-600">
          LinkSnap turns long URLs into short, shareable links and shows you who clicked,
          from where, and on what device.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={user ? '/dashboard' : '/signup'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            {user ? 'Go to dashboard' : 'Get started free'}
          </Link>
          {!user && (
            <Link href="/login" className="bg-white border text-gray-800 px-6 py-3 rounded-lg font-medium">
              Log in
            </Link>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-16 sm:pb-24 w-full">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-white p-5 rounded-xl shadow">
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto py-6 text-center text-sm text-gray-500">
        LinkSnap, a college mini project
      </footer>
    </div>
  );
}