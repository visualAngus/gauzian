export default function handler(req, res) {
    const html = `<!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Bonjour — HTML depuis API</title>
            <style>
                body{font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; background:#f6f8fa; color:#0f172a; padding:2rem}
                .card{max-width:800px;margin:2rem auto;background:#fff;border-radius:12px;box-shadow:0 6px 24px rgba(15,23,42,0.08);padding:2rem;border:1px solid #e6eef8}
                h1{margin:0 0 0.5rem;color:#0b63a7}
                p{margin:0 0 1rem;line-height:1.5}
                a.btn{display:inline-block;padding:0.5rem 1rem;background:#0b63a7;color:#fff;border-radius:8px;text-decoration:none}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Bonjour — HTML stylé depuis une API Next.js</h1>
                <p>Ceci est du HTML renvoyé par la route API <code>/api/hello</code>. Modifiez le HTML/CSS ici pour adapter le style.</p>
                <a class="btn" href="/">Aller à l'accueil</a>
            </div>
        </body>
        </html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}