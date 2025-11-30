export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Démo: accepte seulement test@example.com / password
  if (email === 'test@example.com' && password === 'password') {
    return res.status(200).json({ ok: true, message: 'Connexion réussie (démo)', token: 'fake-jwt-token', user: { id: '1', email } });
  }

  return res.status(401).json({ ok: false, message: 'Identifiants invalides' });
}
