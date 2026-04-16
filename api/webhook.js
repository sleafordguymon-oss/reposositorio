const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { event, data } = payload || {};

    console.log('Webhook recebido:', JSON.stringify(payload, null, 2));

    if (event === 'charge.paid' && data && data.id) {
      const amount = Number(data.amount || 0);
      const updatePayload = {
        status: 'paid',
        updated_at: new Date().toISOString()
      };

      let result = await supabase
        .from('payments')
        .update(updatePayload)
        .eq('transaction_id', data.id)
        .select();

      if (result.error || !result.data || !result.data.length) {
        result = await supabase
          .from('payments')
          .update(updatePayload)
          .eq('amount', amount)
          .eq('status', 'pending')
          .select();
      }

      console.log('Resultado da atualização do webhook:', result.data || result.error);
      return res.status(200).json({ success: true, message: 'Pagamento confirmado com sucesso.' });
    }

    if (event === 'charge.failed' && data && data.id) {
      await supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_id', data.id);
    }

    return res.status(200).json({ success: true, message: 'Evento recebido.' });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
