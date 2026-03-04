export type ClientType = "CLIENTE" | "FORNECEDOR" | "BOTH";

export type Client = {
  id: string;
  name: string;
  phone: string;
  type: ClientType;
  instagram?: string | null;
  notes?: string | null;

  cpf?: string | null;
  email?: string | null;

  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

export type PaymentMode = "AVISTA" | "PARCELADO";
export type PaymentMethod = "PIX" | "DINHEIRO" | "CARTAO" | "BOLETO";

export type OrderStatus =
  | "ORCAMENTO"
  | "PEDIDO"
  | "EM_PRODUCAO"
  | "PRONTO"
  | "ENTREGUE"
  | "CANCELADO";

export type OrderItem = {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type OrderInstallment = {
  id: string;
  dueDate: string; // ISO
  amountCents: number;
  paidAt?: string | null;
};

export type Order = {
  id: string;
  clientId: string;
  clientName?: string;
  status: OrderStatus;
  

  createdAt: string;
  expectedDeliveryAt?: string | null;

  paymentMode?: PaymentMode | null;
  paymentMethod?: PaymentMethod | null;
  installmentsCount?: number | null;
  firstDueDate?: string | null;
  paidNow?: boolean | null;

  subtotalCents: number;
  discountCents: number;
  totalCents: number;

  items: OrderItem[];
  installments?: OrderInstallment[];
  notes?: string | null;
};

export type CostType = "FIXO" | "VARIAVEL";
export type Cost = {
  id: string;
  name: string;
  type: CostType;
  amountCents: number;
  occurredAt?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  category?: string | null;
  description?: string | null;
  isRecurring?: boolean;
};

export type BudgetStatus = "RASCUNHO" | "ENVIADO" | "APROVADO" | "CANCELADO" | "REJEITADO";

export type BudgetMaterial = {
  id: string;
  name: string;
  qty: number;
  unitCostCents: number;
};

export type BudgetItem = {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: number; // calculado (exibição)
  materials: BudgetMaterial[];
};

export type Budget = {
  id: string;
  clientId: string;
  clientName?: string;
  status: BudgetStatus;

  createdAt: string;
  expectedDeliveryAt?: string | null;

  notes?: string | null;

  discountCents: number;
  discountType?: "NONE" | "FIXED" | "PERCENT";
  discountPercent?: number | null;

  deliveryDays: number; // dias fabricação
  dailyRateCents: number;

  paymentMode: PaymentMode;
  paymentMethod?: PaymentMethod | null;
  installmentsCount: number;
  firstDueDate?: string | null;

  profitPercent: number;
  cardFeePercent: number;

  totalCents: number;
  items: BudgetItem[];
};

export type FinanceCategory = {
  id: string;
  name: string;
  type?: "IN" | "OUT" | null;
};

export type FinanceTxType = "IN" | "OUT";
export type FinanceTransaction = {
  id: string;
  type: FinanceTxType;
  name: string;
  occurredAt: string;
  amountCents: number;
  categoryId?: string | null;
  categoryName?: string | null;
  notes?: string | null;

  source?: "MANUAL" | "AUTO" | "RECEIVABLE" | "PAYABLE" | "COST" | string;
};

export type Receivable = {
  id: string;
  dueDate: string;
  clientName: string;
  description: string;
  amountCents: number;
  status: "ABERTO" | "PAGO";
  paidAt?: string | null;
  orderId?: string;
installmentLabel?: string | null;
};

export type Payable = {
  id: string;
  dueDate: string;
  supplierName: string;
  description: string;
  amountCents: number;
  status: "ABERTO" | "PAGO";
  paidAt?: string | null;
  installmentLabel?: string; // "2/6"
  orderId?: string;

};

export type MaterialSupplierPrice = {
  supplierId: string;
  supplierName: string;
  unitCostCents: number;
};

export type Material = {
  id: string;
  name: string;
  unit?: string | null;
  isActive: boolean;
  defaultUnitCostCents: number;
  suppliers: MaterialSupplierPrice[];
};

export type MovementType = "IN" | "OUT" | "ADJUST";

export type MaterialMovement = {
  id: string;
  materialId: string;
  materialName: string;
  type: MovementType;
  qty: number;
  unitCostCents: number;
  totalCents: number;
  occurredAt: string;
  supplierName?: string | null;
  nfNumber?: string | null;
  notes?: string | null;
};