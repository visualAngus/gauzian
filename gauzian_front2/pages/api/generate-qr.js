export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Utiliser l'API QR Server gratuite
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
        return res.status(200).json({ qrDataUrl: qrUrl });
    } catch (error) {
        console.error('QR generation error:', error);
        return res.status(500).json({ error: 'Failed to generate QR code' });
    }
}
