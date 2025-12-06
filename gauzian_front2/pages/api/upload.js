import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const form = new IncomingForm();

  form.parse(req, (err, fields, files) => {
    if (err) {
      res.status(500).json({ message: 'Error parsing form' });
      return;
    }

    const file = files.file[0]; // Assuming single file

    // Ici, vous pouvez traiter le fichier, l'envoyer au cloud, etc.
    // Pour l'exemple, on le sauvegarde localement
    const oldPath = file.filepath;
    const newPath = `/tmp/${file.originalFilename}`;

    fs.rename(oldPath, newPath, (err) => {
      if (err) {
        res.status(500).json({ message: 'Error saving file' });
        return;
      }
      res.status(200).json({ message: 'File uploaded successfully' });
    });
  });
}