const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MASTERPAG_BASE_URL = 'https://api.masterpag.com/functions/v1';

function generateDigits(length) {
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function generateValidCpf() {
  let cpf = generateDigits(9);

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let remainder = sum % 11;
  cpf += remainder < 2 ? '0' : String(11 - remainder);

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  remainder = sum % 11;
  cpf += remainder < 2 ? '0' : String(11 - remainder);

  return cpf;
}

function generateCustomer() {
  const firstNames = ['João', 'Maria', 'Carlos', 'Ana', 'Pedro', 'Fernanda', 'Lucas', 'Juliana', 'Rafael', 'Beatriz'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Costa', 'Pereira', 'Ferreira', 'Rodrigues', 'Alves', 'Martins', 'Gomes'];
  const ddds = ['11', '21', '31', '41'];

  const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  const cleanName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();
  const email = `${cleanName}${Math.floor(Math.random() * 100000)}@pagamento.app`;
  const phone = `${ddds[Math.floor(Math.random() * ddds.length)]}9${generateDigits(8)}`;

  return {
    name,
    email,
    phone,
    document: {
      number: generateValidCpf(),
      type: 'cpf'
    }
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    const publicKey = process.env.MASTERPAG_PUBLIC_KEY;
    const secretKey = process.env.MASTERPAG_SECRET_KEY;

    if (!publicKey || !secretKey) {
      return res.status(500).json({
        success: false,
        error: 'As credenciais da MasterPag não estão configuradas no ambiente.'
      });
    }

    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const plate = (body.plate || '').toString().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const amount = Number(body.amount || 0);

    if (!plate) {
      return res.status(400).json({ success: false, error: 'A placa é obrigatória.' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'O valor do pagamento é obrigatório.' });
    }

    const customer = {
      ...generateCustomer(),
      ...(body.customer || {})
    };

    if (!customer.document || !customer.document.number) {
      customer.document = { number: generateValidCpf(), type: 'cpf' };
    }
    if (!customer.document.type) customer.document.type = 'cpf';

    const expirationDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const payload = {
      amount: Number(amount.toFixed(2)),
      paymentMethod: 'pix',
      customer,
      items: [
        {
          title: `Pagamento de débitos - Placa ${plate}`,
          unitPrice: Number(amount.toFixed(2)),
          quantity: 1,
          tangible: false
        }
      ],
      pix: {
        expirationDate
      },
      postbackUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/webhook`
    };

    const response = await fetch(`${MASTERPAG_BASE_URL}/pix-receive`, {
      method: 'POST',
      headers: {
        'x-public-key': publicKey,
        'x-secret-key': secretKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    const transaction = data?.transaction || data || {};
    const pix = data?.pix || transaction?.pix || {};
    const pixCode = pix.qrCode || pix.copyPaste || data?.copyPaste || null;
    const transactionId = transaction.id || data?.id || data?.shortId || null;
    const status = transaction.status || data?.status || 'pending';
    const expiresAt = pix.expirationDate || pix.expiresAt || data?.expiresAt || expirationDate;

    if (!response.ok || !pixCode || !transactionId) {
      console.error('Falha MasterPag:', data);
      return res.status(response.ok ? 502 : response.status).json({
        success: false,
        error: data?.error?.message || data?.message || 'Erro ao gerar cobrança PIX na MasterPag.',
        details: data
      });
    }

    try {
      await supabase
        .from('payments')
        .upsert([
          {
            transaction_id: transactionId,
            pix_code: pixCode,
            status,
            amount: Number(amount.toFixed(2)),
            plate
          }
        ], { onConflict: 'transaction_id' });
    } catch (dbError) {
      console.error('Erro ao registrar cobrança no Supabase:', dbError);
    }

    return res.status(200).json({
      success: true,
      transactionId,
      pixCode,
      qrImage: pix.qrCodeUrl || null,
      amount: Number(amount.toFixed(2)),
      plate,
      expiresAt,
      status,
      raw: data
    });
  } catch (error) {
    console.error('Erro ao processar cobrança PIX:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno ao gerar PIX.'
    });
  }
};
