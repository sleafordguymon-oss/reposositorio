const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
const MASTERPAG_BASE_URL = 'https://api.masterpag.com/functions/v1';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const { pixCode, transactionId, plate } = req.query;
  console.log('check-payment recebido:', { pixCode, transactionId, plate });

  try {
    let data = null;
    let error = null;

    if (transactionId) {
      const result = await supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .single();
      data = result.data;
      error = result.error;
    }

    if ((error || !data) && pixCode) {
      const result = await supabase
        .from('payments')
        .select('*')
        .eq('pix_code', pixCode)
        .single();
      data = result.data;
      error = result.error;
    }

    if ((error || !data) && plate) {
      const result = await supabase
        .from('payments')
        .select('*')
        .eq('plate', plate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      data = result.data;
      error = result.error;
    }

    if (data && data.status === 'paid') {
      return res.status(200).json({
        success: true,
        status: 'paid',
        data
      });
    }

    if (transactionId) {
      const publicKey = process.env.MASTERPAG_PUBLIC_KEY;
      const secretKey = process.env.MASTERPAG_SECRET_KEY;

      if (publicKey && secretKey) {
        const upstreamResponse = await fetch(
          `${MASTERPAG_BASE_URL}/pix-receive?transaction_id=${encodeURIComponent(transactionId)}`,
          {
            method: 'GET',
            headers: {
              'x-public-key': publicKey,
              'x-secret-key': secretKey
            }
          }
        );

        const upstreamData = await upstreamResponse.json();
        const transaction = upstreamData && upstreamData.transaction ? upstreamData.transaction : null;
        const status = transaction && transaction.status ? transaction.status : 'pending';

        if (transaction && ['paid', 'failed', 'expired', 'refunded'].includes(status)) {
          try {
            await supabase
              .from('payments')
              .upsert([
                {
                  transaction_id: transaction.id || transactionId,
                  pix_code: pixCode || data?.pix_code || null,
                  status,
                  amount: Number(transaction.amount || data?.amount || 0),
                  plate: plate || data?.plate || null
                }
              ], { onConflict: 'transaction_id' });
          } catch (dbError) {
            console.error('Erro ao sincronizar status da MasterPag no Supabase:', dbError);
          }
        }

        return res.status(200).json({
          success: status === 'paid',
          status,
          source: 'masterpag',
          transaction: transaction || null,
          data: data || null
        });
      }
    }

    return res.status(200).json({
      success: false,
      status: data?.status || 'pending',
      data: data || null
    });
  } catch (err) {
    console.error('Erro ao verificar pagamento:', err);
    return res.status(200).json({
      success: false,
      status: 'pending',
      error: err.message
    });
  }
};
