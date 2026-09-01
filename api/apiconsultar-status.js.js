// api/consultar-status.js
import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const apiKey = process.env.BRAVOPAY_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'API key não configurada.' });
      return;
    }

    const transactionId = req.query.id;
    if (!transactionId) {
      res.status(400).json({ error: 'ID da transação não fornecido.' });
      return;
    }

    const response = await axios.get(`https://bravopay.club/api/v1/transactions/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    res.status(200).json(response.data);

  } catch (error) {
    console.error('Erro ao consultar status:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao consultar status.' });
  }
}