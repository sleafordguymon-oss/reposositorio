import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwYXdrY21lY3d3b3Brb2Jrd3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNzI4NzAsImV4cCI6MjA1Njg0ODg3MH0.K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função para criar a tabela de pagamentos
export async function initializePaymentsTable() {
  try {
    // Verificar se a tabela já existe
    const { data, error } = await supabase
      .from('payments')
      .select('id')
      .limit(1);
    
    if (!error) {
      console.log('Tabela de pagamentos já existe');
      return true;
    }
    
    // Se não existe, criar a tabela
    console.log('Criando tabela de pagamentos...');
    
    // Usar a API REST para criar a tabela
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          CREATE TABLE IF NOT EXISTS payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id TEXT UNIQUE NOT NULL,
            pix_code TEXT,
            status TEXT DEFAULT 'pending',
            amount DECIMAL(10, 2),
            plate TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `
      })
    });
    
    console.log('Tabela criada com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao inicializar tabela:', error);
    return false;
  }
}

// Função para registrar um pagamento
export async function recordPayment(transactionId, pixCode, amount, plate) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          transaction_id: transactionId,
          pix_code: pixCode,
          status: 'pending',
          amount: amount,
          plate: plate
        }
      ])
      .select();
    
    if (error) {
      console.error('Erro ao registrar pagamento:', error);
      return null;
    }
    
    console.log('Pagamento registrado:', data);
    return data[0];
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return null;
  }
}

// Função para marcar um pagamento como pago
export async function markPaymentAsPaid(transactionId) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('transaction_id', transactionId)
      .select();
    
    if (error) {
      console.error('Erro ao atualizar pagamento:', error);
      return null;
    }
    
    console.log('Pagamento marcado como pago:', data);
    return data[0];
  } catch (error) {
    console.error('Erro ao atualizar pagamento:', error);
    return null;
  }
}

// Função para verificar o status de um pagamento
export async function checkPaymentStatus(transactionId) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', transactionId)
      .single();
    
    if (error) {
      console.error('Erro ao verificar pagamento:', error);
      return { success: false, status: 'pending' };
    }
    
    return {
      success: data.status === 'paid',
      status: data.status,
      data: data
    };
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return { success: false, status: 'pending' };
  }
}
