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
    const plateRaw = (req.query.plate || req.query.placa || '').toString();
    const plate = plateRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!plate || plate.length < 7) {
      return res.status(400).json({
        success: false,
        error: 'Informe uma placa válida com 7 caracteres.'
      });
    }

    const upstreamUrl = `https://h4h43h34.onrender.com/consultar/${encodeURIComponent(plate)}`;
    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const rawText = await upstreamResponse.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      return res.status(502).json({
        success: false,
        error: 'A resposta da consulta externa não veio em JSON válido.',
        details: rawText.slice(0, 500)
      });
    }

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        success: false,
        error: data.error || data.message || 'Falha ao consultar a placa no serviço externo.',
        details: data
      });
    }

    const debitos = Array.isArray(data.debitos) ? data.debitos : [];
    const normalizedDebitos = debitos.map((item, index) => {
      const valorTexto = (item.valor || item.value || '0').toString().trim();
      const valorNumero = Number(
        valorTexto
          .replace(/\./g, '')
          .replace(',', '.')
          .replace(/[^0-9.\-]/g, '')
      ) || 0;

      return {
        id: item.id || `debito_${index + 1}`,
        plate: (item.placa || item.plate || plate).toString().toUpperCase(),
        concessionaria: item.concessao || item.concessionaria || item.concession || 'Concessionária não informada',
        dataHora: item.data_hora || item.dataHora || item.date || '',
        valor: valorNumero,
        valorFormatado: valorTexto.includes(',') ? valorTexto : valorNumero.toFixed(2).replace('.', ','),
        original: item
      };
    });

    const total = normalizedDebitos.reduce((sum, item) => sum + item.valor, 0);

    return res.status(200).json({
      success: data.success !== false,
      plate,
      quantidade: normalizedDebitos.length,
      total: Math.round(total * 100) / 100,
      debitos: normalizedDebitos,
      source: data
    });
  } catch (error) {
    console.error('Erro ao consultar débitos por placa:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao consultar a placa.',
      details: error.message
    });
  }
};
