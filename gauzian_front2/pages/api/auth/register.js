export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { name, email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Ici on simule la création d'utilisateur. Remplacez par votre logique réelle.
  const user = { id: String(Date.now()), name: name || '', email };

  return res.status(201).json({ ok: true, message: 'Utilisateur créé (démo)', user });
}
