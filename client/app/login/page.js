"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white p-6 rounded-xl shadow space-y-4"
      >
        <Link
          href="/"
          className="block text-center text-xl font-bold text-blue-600"
        >
          LinkSnap
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Log in to LinkSnap</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 text-gray-900"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 text-gray-900"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-60"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>

        <p className="text-sm text-gray-600">
          No account?{" "}
          <Link href="/signup" className="text-blue-600 underline">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
