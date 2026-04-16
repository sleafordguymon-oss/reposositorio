// Armazenar pagamentos recentes em memória
let paidPayments = {};

export function recordPaidPayment(pixCode, transactionId) {
  paidPayments[pixCode] = {
    status: 'paid',
    transactionId: transactionId,
    timestamp: Date.now()
  };
  
  console.log('Pagamento registrado:', { pixCode, transactionId });
  
  // Limpar após 10 minutos
  setTimeout(() => {
    delete paidPayments[pixCode];
    console.log('Pagamento expirado:', pixCode);
  }, 10 * 60 * 1000);
}

export function checkPaidPayment(pixCode) {
  const payment = paidPayments[pixCode];
  
  if (payment && payment.status === 'paid') {
    // Não remover ainda, deixar para expirar naturalmente
    return {
      success: true,
      status: 'paid',
      transactionId: payment.transactionId
    };
  }
  
  return {
    success: false,
    status: 'pending'
  };
}

export function clearPaidPayment(pixCode) {
  delete paidPayments[pixCode];
}
