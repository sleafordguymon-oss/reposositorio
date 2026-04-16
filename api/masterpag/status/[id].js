const MASTERPAG_BASE_URL = 'https://api.masterpag.com/functions/v1';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    const id = (req.query.id || req.query.transaction_id || '').toString().trim();
    const publicKey = process.env.MASTERPAG_PUBLIC_KEY;
    const secretKey = process.env.MASTERPAG_SECRET_KEY;

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID da transação é obrigatório.' });
    }

    if (!publicKey || !secretKey) {
      return res.status(500).json({ success: false, error: 'Credenciais da MasterPag não configuradas.' });
    }

    const response = await fetch(`${MASTERPAG_BASE_URL}/pix-receive?transaction_id=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'x-public-key': publicKey,
        'x-secret-key': secretKey
      }
    });

    const data = await response.json();
    const transaction = data && data.transaction ? data.transaction : null;

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error?.message || data?.message || 'Falha ao consultar o status da transação.',
        details: data
      });
    }

    return res.status(200).json({
      success: !!transaction,
      status: transaction?.status || 'pending',
      transaction
    });
  } catch (error) {
    console.error('Erro ao consultar status da MasterPag:', error);
    return res.status(500).json({ success: false, error: error.message || 'Erro interno.' });
  }
};
