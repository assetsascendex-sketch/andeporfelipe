// ----------------------------------------------------------------
// Captura e armazenamento de UTMs (obrigatório para rastreamento)
// ----------------------------------------------------------------
function capturarUTMs() {
    const params = new URLSearchParams(window.location.search);
    const utmFields = [
        'utm_source', 'utm_medium', 'utm_campaign',
        'utm_content', 'utm_term', 'fbclid', 'ttclid', 'gclid'
    ];

    let utmData = {};

    // Verifica se já existem UTMs salvos no localStorage
    const savedUTMs = localStorage.getItem('utm_data');
    if (savedUTMs) {
        utmData = JSON.parse(savedUTMs);
    }

    // Atualiza com os parâmetros atuais da URL
    let hasNewUTM = false;
    utmFields.forEach(field => {
        const value = params.get(field);
        if (value) {
            utmData[field] = value;
            hasNewUTM = true;
        }
    });

    // Se houver novos UTMs, salva no localStorage
    if (hasNewUTM) {
        localStorage.setItem('utm_data', JSON.stringify(utmData));
    }

    return utmData;
}

// ----------------------------------------------------------------
// Função para gerar o PIX
// ----------------------------------------------------------------
let pollingInterval = null;
let currentTransactionId = null;

async function gerarPix() {
    // Limpa mensagens de erro
    document.getElementById('erroFormulario').innerText = '';

    // Coleta dados do formulário
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const valor = document.getElementById('valor').value;

    // Validações
    if (!nome || !email || !cpf || !valor || parseFloat(valor) <= 0) {
        document.getElementById('erroFormulario').innerText = 'Preencha todos os campos obrigatórios.';
        return;
    }

    // Converte valor para centavos
    const amountCents = Math.round(parseFloat(valor) * 100);

    // Captura UTMs armazenados
    const utmData = capturarUTMs();

    // Prepara payload para o backend
    const payload = {
        nome,
        email,
        telefone,
        cpf,
        amount_cents: amountCents,
        utm: utmData,
        external_reference: `pedido_${Date.now()}`
    };

    // Desabilita botão e mostra spinner (opcional)
    const btn = document.getElementById('btnGerarPix');
    btn.disabled = true;
    btn.innerText = 'Gerando...';

    try {
        // Chama a API do backend
        const response = await fetch('/api/criar-transacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao criar transação');
        }

        // Armazena ID da transação para polling
        currentTransactionId = data.transaction_id;

        // Exibe QR Code e código PIX
        mostrarPix(data);

        // Inicia polling de status
        iniciarPolling(currentTransactionId);

    } catch (error) {
        document.getElementById('erroFormulario').innerText = error.message;
        btn.disabled = false;
        btn.innerText = 'Gerar PIX';
    }
}

// ----------------------------------------------------------------
// Exibe o QR Code e o código copia-e-cola
// ----------------------------------------------------------------
function mostrarPix(data) {
    // Esconde formulário, mostra área do PIX
    document.getElementById('formSection').classList.add('hidden');
    document.getElementById('pixSection').classList.remove('hidden');
    document.getElementById('successSection').classList.add('hidden');

    // Gera QR Code usando a biblioteca qrcode-generator
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = ''; // limpa
    const qr = qrcode(0, 'M');
    qr.addData(data.pix_copy_paste);
    qr.make();
    qrContainer.innerHTML = qr.createImgTag(5, 5, 'QR Code PIX');

    // Mostra o código copia-e-cola
    document.getElementById('copyPaste').innerText = data.pix_copy_paste;

    // Atualiza mensagem de status
    document.getElementById('statusMessage').innerText = 'Escaneie o QR Code ou copie o código PIX';
}

// ----------------------------------------------------------------
// Polling de status a cada 3 segundos
// ----------------------------------------------------------------
function iniciarPolling(transactionId) {
    // Limpa qualquer polling anterior
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status-transacao/${transactionId}`);
            const data = await response.json();

            // Atualiza status na tela
            const statusDetalhe = document.getElementById('statusDetalhe');
            switch (data.status) {
                case 'PENDING':
                    statusDetalhe.innerText = 'Aguardando pagamento...';
                    break;
                case 'PAID':
                    clearInterval(pollingInterval);
                    // Esconde área do PIX e mostra sucesso
                    document.getElementById('pixSection').classList.add('hidden');
                    document.getElementById('successSection').classList.remove('hidden');
                    // Redireciona para /obrigado após 2 segundos
                    setTimeout(() => {
                        window.location.href = '/obrigado.html';
                    }, 2000);
                    break;
                case 'EXPIRED':
                    clearInterval(pollingInterval);
                    statusDetalhe.innerText = 'PIX expirado. Gere um novo.';
                    // Permite tentar novamente
                    document.getElementById('btnGerarPix').disabled = false;
                    document.getElementById('btnGerarPix').innerText = 'Gerar PIX';
                    document.getElementById('formSection').classList.remove('hidden');
                    document.getElementById('pixSection').classList.add('hidden');
                    break;
                default:
                    clearInterval(pollingInterval);
                    statusDetalhe.innerText = `Status: ${data.status}`;
            }
        } catch (error) {
            console.error('Erro no polling:', error);
        }
    }, 3000);
}

// ----------------------------------------------------------------
// Copiar código PIX
// ----------------------------------------------------------------
function copiarCodigo() {
    const codigo = document.getElementById('copyPaste').innerText;
    navigator.clipboard.writeText(codigo).then(() => {
        alert('Código PIX copiado!');
    }).catch(() => {
        // Fallback para navegadores antigos
        const textarea = document.createElement('textarea');
        textarea.value = codigo;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Código PIX copiado!');
    });
}

// ----------------------------------------------------------------
// Cancelar pagamento atual
// ----------------------------------------------------------------
function cancelarPagamento() {
    if (pollingInterval) clearInterval(pollingInterval);
    currentTransactionId = null;
    document.getElementById('pixSection').classList.add('hidden');
    document.getElementById('formSection').classList.remove('hidden');
    document.getElementById('btnGerarPix').disabled = false;
    document.getElementById('btnGerarPix').innerText = 'Gerar PIX';
}

// Captura UTMs ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    capturarUTMs();
});