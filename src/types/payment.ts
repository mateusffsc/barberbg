export type PaymentMethod = 'money' | 'pix' | 'credit_card' | 'debit_card';

export interface PaymentInfo {
  method: PaymentMethod;
  amount: number;
  created_at: string;
}

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    value: 'money',
    label: 'Dinheiro',
    icon: '💵'
  },
  {
    value: 'pix',
    label: 'PIX',
    icon: '📱'
  },
  {
    value: 'credit_card',
    label: 'Cartão de Crédito',
    icon: '💳'
  },
  {
    value: 'debit_card',
    label: 'Cartão de Débito',
    icon: '💳'
  }
];

export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const option = PAYMENT_METHODS.find(m => m.value === method);
  return option ? option.label : method;
};

export const getPaymentMethodIcon = (method: PaymentMethod): string => {
  const option = PAYMENT_METHODS.find(m => m.value === method);
  return option ? option.icon : '💰';
};