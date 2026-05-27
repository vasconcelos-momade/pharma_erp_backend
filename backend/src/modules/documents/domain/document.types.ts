export type DocumentArtifactKind = "INVOICE_PDF" | "INVOICE_RECEIPT" | "INVOICE_ESC_POS";
export type DocumentArtifactFormat = "PDF" | "HTML" | "JSON" | "ESC_POS";
export type DocumentArtifactStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export interface DocumentLineSnapshot {
  id: string;
  type: "produto" | "servico";
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  discount: number;
  total: number;
  lots: Array<{
    lotId: string;
    code: string;
    quantity: number;
  }>;
}

export interface InvoiceDocumentSnapshotPayload {
  snapshotVersion: number;
  invoiceId: string;
  number: string;
  series: string | null;
  type: string;
  status: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string | null;
    name: string;
    document: string | null;
  };
  operator: {
    id: string | null;
    name: string;
    role: string | null;
  };
  terminal: {
    id: string | null;
    name: string | null;
    code: string | null;
    branchName: string | null;
  };
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  payment: {
    method: string | null;
    entries: Array<{
      id: string;
      method: string;
      amount: number;
      status: string;
      reference: string | null;
      createdAt: string;
    }>;
  };
  cancellation: null | {
    cancelledAt: string;
    reason: string;
    notes: string | null;
    cancelledBy: {
      id: string | null;
      name: string;
      role: string | null;
    } | null;
  };
  fiscal: {
    operationType: string | null;
    qrPayload: string | null;
    qrCodeDataUrl: string | null;
    legalText: string[];
    futureSignature: {
      signed: boolean;
      signatureHash: string | null;
    };
  };
  branding: {
    companyName: string;
    tagline: string | null;
    logoUrl: string | null;
    address: string | null;
    taxId: string | null;
    contacts: string[];
  };
  items: DocumentLineSnapshot[];
}

export interface StoredArtifact {
  bucket: string;
  key: string;
  url: string;
  size: number;
  checksumSha256: string;
}

export interface GeneratedDocumentArtifact {
  kind: DocumentArtifactKind;
  format: DocumentArtifactFormat;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  cacheKey: string;
  metadata?: Record<string, unknown>;
  engine: string;
  engineVersion: string;
}
