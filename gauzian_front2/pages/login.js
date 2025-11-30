import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      setMessage({ type: 'success', text: data.message || 'Connecté' });
      // pour démo, afficher le token en console
      console.log('TOKEN:', data.token);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Se connecter</h1>
        <p className="muted">Entrez vos identifiants pour vous connecter (démo).</p>

        {message && (
          <div className={`alert ${message.type === 'error' ? 'err' : 'ok'}`}>{message.text}</div>
        )}

        <form onSubmit={handleSubmit} className="form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
          </label>

          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
          </label>

          <div className="actions">
            <button type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
            <Link href="/register" className="link">Pas encore inscrit ?</Link>
          </div>
        </form>

        <p className="hint">Pour tester en démo : email <code>test@example.com</code> / mot de passe <code>password</code></p>
      </div>

      <style jsx>{`
        .page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:linear-gradient(180deg,#eef2f7, #f8fafc)}
        .card{width:100%;max-width:540px;background:#fff;padding:2rem;border-radius:12px;box-shadow:0 8px 30px rgba(2,6,23,0.08);border:1px solid #e6eef8}
        h1{margin:0 0 0.25rem;color:#0b63a7}
        .muted{color:#61708a;margin:0 0 1rem}
        .form label{display:block;margin-bottom:0.75rem;font-size:0.95rem}
        input{width:100%;padding:0.65rem 0.75rem;margin-top:0.35rem;border-radius:8px;border:1px solid #d7e3f2;background:#fbfdff}
        .actions{display:flex;align-items:center;gap:1rem;margin-top:1rem}
        button{background:#0b63a7;color:#fff;padding:0.6rem 1rem;border-radius:8px;border:none;cursor:pointer}
        button:disabled{opacity:0.6;cursor:default}
        .link{color:#0b63a7;text-decoration:underline}
        .alert{padding:0.6rem 0.75rem;border-radius:8px;margin:0.5rem 0}
        .alert.err{background:#fff0f0;color:#8b1a1a;border:1px solid #ffd6d6}
        .alert.ok{background:#f0fff6;color:#075e2e;border:1px solid #c5f7d7}
        .hint{margin-top:1rem;color:#6b7788;font-size:0.9rem}
        code{background:#f3f6fb;padding:0.15rem 0.35rem;border-radius:4px}
      `}</style>
    </main>
  );
}
