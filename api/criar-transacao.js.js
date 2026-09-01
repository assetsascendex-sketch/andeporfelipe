// api/criar-transacao.js
import axios from 'axios';

export default async function handler(req, res) {
  // Configura CORS para permitir chamadas do frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // Responde imediatamente a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const apiKey = process.env.BRAVOPAY_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'API key não configurada.' });
      return;
    }

    const { amount_cents, utm, external_reference, nome, email, telefone, cpf } = req.body;

    if (!amount_cents) {
      res.status(400).json({ error: 'Valor da doação é obrigatório.' });
      return;
    }

    const payload = {
      amount_cents: parseInt(amount_cents),
      method: 'pix',
      external_reference: external_reference || `pedido_${Date.now()}`,
      utm: utm || {}
    };

    // Inclui customer apenas se algum dado for fornecido (opcional)
    if (nome || email || telefone || cpf) {
      payload.customer = {
        name: nome || '',
        email: email || '',
        phone: telefone || '',
        cpf: cpf || ''
      };
    }

    // Inclui product_id se estiver definido nas variáveis de ambiente
    if (process.env.PRODUCT_ID) {
      payload.product_id = process.env.PRODUCT_ID;
    }

    const response = await axios.post('https://bravopay.club/api/v1/transactions', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    res.status(200).json({
      transaction_id: response.data.id,
      pix_copy_paste: response.data.pix.copy_paste,
      expires_at: response.data.pix.expires_at,
      status: response.data.status
    });

  } catch (error) {
    console.error('Erro ao criar transação:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao processar pagamento.' });
  }
}