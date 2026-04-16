const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Função para obter dados do Upstash
async function getFromUpstash(key) {
  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    return result.result ? JSON.parse(result.result) : null;
  } catch (error) {
    console.error('Erro ao obter do Upstash:', error);
    return null;
  }
}

// Função para listar todas as chaves
async function listKeys(pattern) {
  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/scan/0?match=${pattern}&count=100`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    return result.result ? result.result[1] : [];
  } catch (error) {
    console.error('Erro ao listar chaves do Upstash:', error);
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const { action, key } = req.query;

    if (action === 'get' && key) {
      // Obter um webhook específico
      const data = await getFromUpstash(key);
      return res.status(200).json({ key, data });
    }

    if (action === 'list') {
      // Listar todos os webhooks charge.paid
      const keys = await listKeys('charge_paid:*');
      const webhooks = [];
      
      for (const k of keys) {
        const data = await getFromUpstash(k);
        if (data) {
          webhooks.push({ key: k, data });
        }
      }
      
      return res.status(200).json({ 
        total: webhooks.length,
        webhooks: webhooks.sort((a, b) => new Date(b.data.timestamp) - new Date(a.data.timestamp))
      });
    }

    if (action === 'list-all') {
      // Listar TODOS os webhooks
      const keys = await listKeys('webhook:*');
      const webhooks = [];
      
      for (const k of keys) {
        const data = await getFromUpstash(k);
        if (data) {
          webhooks.push({ key: k, data });
        }
      }
      
      return res.status(200).json({ 
        total: webhooks.length,
        webhooks: webhooks.sort((a, b) => new Date(b.data.timestamp) - new Date(a.data.timestamp))
      });
    }

    return res.status(200).json({ 
      message: 'Use ?action=list para listar webhooks charge.paid, ?action=list-all para listar todos, ou ?action=get&key=<key> para obter um específico'
    });
  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
