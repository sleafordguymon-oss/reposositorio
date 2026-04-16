import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ler a imagem do sistema de arquivos
    const imagePath = path.join(process.cwd(), 'public', 'hero-bg.jpg');
    const imageBuffer = fs.readFileSync(imagePath);

    // Fazer upload para o Vercel Blob
    const blob = await put('hero-bg.jpg', imageBuffer, {
      access: 'public',
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      message: 'Imagem enviada com sucesso para o Blob Storage'
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return res.status(500).json({
      error: 'Erro ao fazer upload da imagem',
      details: error.message
    });
  }
}
