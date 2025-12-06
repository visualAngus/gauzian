export default function Home() {
  return (
    <main style={{fontFamily: 'system-ui, sans-serif', padding: 24}}>
      <h1>Bienvenue dans gauzian_front2</h1>
      <p>Projet Next.js minimal — page d'accueil.</p>
      <p>
        Test API: <a href="/api/hello">/api/hello</a>
        <br />
        Inscription: <a href="/register">/register</a>
        <br />
        Connexion: <a href="/login">/login</a>
        <br />
        Drive: <a href="/drive">/drive</a>
      </p>
    </main>
  )
}
