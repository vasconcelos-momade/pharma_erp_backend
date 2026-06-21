
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  role: 'role',
  active: 'active',
  centralUserId: 'centralUserId',
  version: 'version',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TerminalScalarFieldEnum = {
  id: 'id',
  codigo: 'codigo',
  nome: 'nome',
  localizacao: 'localizacao',
  ativo: 'ativo',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CaixaScalarFieldEnum = {
  id: 'id',
  terminalId: 'terminalId',
  saldoAtual: 'saldoAtual',
  version: 'version',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.CaixaMovimentoScalarFieldEnum = {
  id: 'id',
  caixaId: 'caixaId',
  userId: 'userId',
  faturaId: 'faturaId',
  tipo: 'tipo',
  origem: 'origem',
  categoria: 'categoria',
  valor: 'valor',
  saldoAnterior: 'saldoAnterior',
  saldoFinal: 'saldoFinal',
  idempotencyKey: 'idempotencyKey',
  descricao: 'descricao',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ClienteScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  telefone: 'telefone',
  email: 'email',
  tipo: 'tipo',
  documento: 'documento',
  dataNascimento: 'dataNascimento',
  sexo: 'sexo',
  nuit: 'nuit',
  endereco: 'endereco',
  empresaId: 'empresaId',
  limiteCredito: 'limiteCredito',
  saldoAtual: 'saldoAtual',
  temPrescricao: 'temPrescricao',
  version: 'version',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmpresaScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  nuit: 'nuit',
  limiteCredito: 'limiteCredito',
  saldoUsado: 'saldoUsado',
  ativo: 'ativo',
  statusContrato: 'statusContrato',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.ConvenioContratoScalarFieldEnum = {
  id: 'id',
  empresaId: 'empresaId',
  limite: 'limite',
  desconto: 'desconto',
  createdAt: 'createdAt'
};

exports.Prisma.ProdutoScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  substanciaActiva: 'substanciaActiva',
  dosagem: 'dosagem',
  forma: 'forma',
  apresentacao: 'apresentacao',
  ativo: 'ativo',
  barcode: 'barcode',
  precoVenda: 'precoVenda',
  estoqueMinimo: 'estoqueMinimo',
  taxRuleId: 'taxRuleId',
  version: 'version',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProdutoRegulacaoScalarFieldEnum = {
  produtoId: 'produtoId',
  antimicrobiano: 'antimicrobiano',
  tipoDispensacao: 'tipoDispensacao',
  requiresPrescription: 'requiresPrescription',
  requiresDoubleCheck: 'requiresDoubleCheck',
  requiresPsychotropicBook: 'requiresPsychotropicBook',
  requiresManualReview: 'requiresManualReview',
  riskLevel: 'riskLevel',
  policyVersion: 'policyVersion',
  classificadoEm: 'classificadoEm',
  classificadoPor: 'classificadoPor',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProdutoClassificacaoEventoScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  rule: 'rule',
  reason: 'reason',
  matchedTerm: 'matchedTerm',
  source: 'source',
  policySnapshot: 'policySnapshot',
  createdAt: 'createdAt'
};

exports.Prisma.ServicoScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  tipoServicoClinico: 'tipoServicoClinico',
  preco: 'preco',
  ativo: 'ativo',
  taxRuleId: 'taxRuleId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FornecedorScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  tipo: 'tipo',
  nuit: 'nuit',
  email: 'email',
  telefone: 'telefone',
  telefoneAlt: 'telefoneAlt',
  endereco: 'endereco',
  cidade: 'cidade',
  provincia: 'provincia',
  pais: 'pais',
  contatoNome: 'contatoNome',
  observacoes: 'observacoes',
  ativo: 'ativo',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProdutoFornecedorScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  fornecedorId: 'fornecedorId',
  precoCompra: 'precoCompra',
  fornecedorPrincipal: 'fornecedorPrincipal',
  prazoEntregaDias: 'prazoEntregaDias',
  codigoFornecedor: 'codigoFornecedor'
};

exports.Prisma.CompraScalarFieldEnum = {
  id: 'id',
  numeroDocumento: 'numeroDocumento',
  fornecedorId: 'fornecedorId',
  data: 'data',
  total: 'total',
  status: 'status',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CompraItemScalarFieldEnum = {
  id: 'id',
  compraId: 'compraId',
  produtoId: 'produtoId',
  numeroLote: 'numeroLote',
  dataValidade: 'dataValidade',
  quantidade: 'quantidade',
  precoCompra: 'precoCompra',
  precoVenda: 'precoVenda',
  total: 'total'
};

exports.Prisma.LoteScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  fornecedorId: 'fornecedorId',
  numeroLote: 'numeroLote',
  dataValidade: 'dataValidade',
  dataFabricacao: 'dataFabricacao',
  quantidadeInicial: 'quantidadeInicial',
  quantidadeAtual: 'quantidadeAtual',
  quantidadeQuarentena: 'quantidadeQuarentena',
  quantidadeIncinerada: 'quantidadeIncinerada',
  precoCompra: 'precoCompra',
  precoVenda: 'precoVenda',
  ativo: 'ativo',
  estadoSanitario: 'estadoSanitario',
  disponibilidade: 'disponibilidade',
  version: 'version',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.LoteMovimentoSanitarioScalarFieldEnum = {
  id: 'id',
  loteId: 'loteId',
  tipo: 'tipo',
  quantidade: 'quantidade',
  motivo: 'motivo',
  responsavelId: 'responsavelId',
  documentoReferencia: 'documentoReferencia',
  createdAt: 'createdAt'
};

exports.Prisma.IncineracaoScalarFieldEnum = {
  id: 'id',
  numeroAuto: 'numeroAuto',
  dataIncineracao: 'dataIncineracao',
  responsavelId: 'responsavelId',
  aprovadoPorId: 'aprovadoPorId',
  entidadeDestino: 'entidadeDestino',
  observacoes: 'observacoes',
  createdAt: 'createdAt'
};

exports.Prisma.IncineracaoItemScalarFieldEnum = {
  id: 'id',
  incineracaoId: 'incineracaoId',
  loteId: 'loteId',
  quantidade: 'quantidade',
  motivo: 'motivo'
};

exports.Prisma.EstoqueMovimentoScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  loteId: 'loteId',
  userId: 'userId',
  tipo: 'tipo',
  quantidade: 'quantidade',
  estoqueAnterior: 'estoqueAnterior',
  estoqueFinal: 'estoqueFinal',
  origem: 'origem',
  idempotencyKey: 'idempotencyKey',
  observacoes: 'observacoes',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.HistoricoPrecoScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  fornecedorId: 'fornecedorId',
  precoAnterior: 'precoAnterior',
  precoNovo: 'precoNovo',
  variacao: 'variacao',
  data: 'data'
};

exports.Prisma.AlertaEstoqueScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  tipo: 'tipo',
  mensagem: 'mensagem',
  resolvido: 'resolvido',
  createdAt: 'createdAt'
};

exports.Prisma.FaturaScalarFieldEnum = {
  id: 'id',
  numero: 'numero',
  serie: 'serie',
  tipo: 'tipo',
  clienteId: 'clienteId',
  terminalId: 'terminalId',
  userId: 'userId',
  idempotencyKey: 'idempotencyKey',
  subtotal: 'subtotal',
  desconto: 'desconto',
  ivaTotal: 'ivaTotal',
  total: 'total',
  valorRecebido: 'valorRecebido',
  troco: 'troco',
  tipoOperacao: 'tipoOperacao',
  tipoPagamento: 'tipoPagamento',
  moeda: 'moeda',
  estado: 'estado',
  qrCode: 'qrCode',
  deletedAt: 'deletedAt',
  version: 'version',
  authorizedById: 'authorizedById',
  cancelledAt: 'cancelledAt',
  cancelledById: 'cancelledById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FaturaItemScalarFieldEnum = {
  id: 'id',
  faturaId: 'faturaId',
  produtoId: 'produtoId',
  servicoId: 'servicoId',
  loteId: 'loteId',
  descricao: 'descricao',
  quantidade: 'quantidade',
  precoUnit: 'precoUnit',
  custoUnitario: 'custoUnitario',
  lucroUnitario: 'lucroUnitario',
  baseCalculo: 'baseCalculo',
  iva: 'iva',
  valorIva: 'valorIva',
  taxaAplicada: 'taxaAplicada',
  tipoRegraFiscalSnapshot: 'tipoRegraFiscalSnapshot',
  codigoRegraFiscal: 'codigoRegraFiscal',
  moedaTaxa: 'moedaTaxa',
  motivoIsencao: 'motivoIsencao',
  total: 'total'
};

exports.Prisma.ContaReceberScalarFieldEnum = {
  id: 'id',
  clienteId: 'clienteId',
  faturaId: 'faturaId',
  userId: 'userId',
  authorizedById: 'authorizedById',
  valor: 'valor',
  saldo: 'saldo',
  status: 'status',
  vencimento: 'vencimento',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ContaReceberPagamentoScalarFieldEnum = {
  id: 'id',
  contaReceberId: 'contaReceberId',
  userId: 'userId',
  caixaId: 'caixaId',
  valor: 'valor',
  metodo: 'metodo',
  createdAt: 'createdAt'
};

exports.Prisma.ContaPagarScalarFieldEnum = {
  id: 'id',
  fornecedorId: 'fornecedorId',
  compraId: 'compraId',
  userId: 'userId',
  valor: 'valor',
  saldo: 'saldo',
  status: 'status',
  vencimento: 'vencimento',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EstoqueReservaScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  loteId: 'loteId',
  faturaId: 'faturaId',
  quantidade: 'quantidade',
  expiresAt: 'expiresAt',
  idempotencyKey: 'idempotencyKey',
  createdAt: 'createdAt'
};

exports.Prisma.FinancialMovementScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  caixaId: 'caixaId',
  faturaId: 'faturaId',
  contaReceberId: 'contaReceberId',
  contaPagarId: 'contaPagarId',
  type: 'type',
  amount: 'amount',
  reference: 'reference',
  idempotencyKey: 'idempotencyKey',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt'
};

exports.Prisma.PagamentoScalarFieldEnum = {
  id: 'id',
  faturaId: 'faturaId',
  caixaId: 'caixaId',
  metodo: 'metodo',
  valor: 'valor',
  status: 'status',
  referencia: 'referencia',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  version: 'version'
};

exports.Prisma.LivroPsicotropicoScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  loteId: 'loteId',
  dispensacaoId: 'dispensacaoId',
  tipoMovimento: 'tipoMovimento',
  quantidade: 'quantidade',
  saldoAnterior: 'saldoAnterior',
  saldoAtual: 'saldoAtual',
  numeroDocumento: 'numeroDocumento',
  idempotencyKey: 'idempotencyKey',
  observacoes: 'observacoes',
  responsavelId: 'responsavelId',
  createdAt: 'createdAt'
};

exports.Prisma.RolePermissionScalarFieldEnum = {
  id: 'id',
  role: 'role',
  module: 'module',
  action: 'action',
  createdAt: 'createdAt'
};

exports.Prisma.StockBalanceScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  quantidadeTotal: 'quantidadeTotal',
  quantidadeReservada: 'quantidadeReservada',
  quantidadeDisponivel: 'quantidadeDisponivel',
  version: 'version',
  lastUpdated: 'lastUpdated'
};

exports.Prisma.InventarioScalarFieldEnum = {
  id: 'id',
  codigo: 'codigo',
  observacao: 'observacao',
  status: 'status',
  iniciadoPorId: 'iniciadoPorId',
  reconciliadoPorId: 'reconciliadoPorId',
  iniciadoEm: 'iniciadoEm',
  reconciliadoEm: 'reconciliadoEm',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventarioItemScalarFieldEnum = {
  id: 'id',
  inventarioId: 'inventarioId',
  produtoId: 'produtoId',
  loteId: 'loteId',
  estoqueSistema: 'estoqueSistema',
  estoqueContado: 'estoqueContado',
  divergencia: 'divergencia'
};

exports.Prisma.RequisicaoScalarFieldEnum = {
  id: 'id',
  numeroDocumento: 'numeroDocumento',
  origem: 'origem',
  destino: 'destino',
  tipo: 'tipo',
  status: 'status',
  observacao: 'observacao',
  fornecedorId: 'fornecedorId',
  total: 'total',
  userId: 'userId',
  confirmedAt: 'confirmedAt',
  confirmedById: 'confirmedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RequisicaoItemScalarFieldEnum = {
  id: 'id',
  requisicaoId: 'requisicaoId',
  produtoId: 'produtoId',
  loteId: 'loteId',
  quantidadeSolicitada: 'quantidadeSolicitada',
  numeroLote: 'numeroLote',
  dataValidade: 'dataValidade',
  precoCompra: 'precoCompra',
  precoVenda: 'precoVenda',
  subtotal: 'subtotal'
};

exports.Prisma.CashBalanceScalarFieldEnum = {
  id: 'id',
  caixaId: 'caixaId',
  saldoDinheiro: 'saldoDinheiro',
  saldoDigital: 'saldoDigital',
  saldoTotal: 'saldoTotal',
  lastUpdated: 'lastUpdated'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  action: 'action',
  entity: 'entity',
  entityId: 'entityId',
  before: 'before',
  after: 'after',
  ip: 'ip',
  userAgent: 'userAgent',
  hashAnterior: 'hashAnterior',
  hashAtual: 'hashAtual',
  createdAt: 'createdAt'
};

exports.Prisma.SanitarioReportScalarFieldEnum = {
  id: 'id',
  tipo: 'tipo',
  periodo: 'periodo',
  arquivoUrl: 'arquivoUrl',
  payload: 'payload',
  geradoPorId: 'geradoPorId',
  createdAt: 'createdAt'
};

exports.Prisma.DigitalSignatureScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  entity: 'entity',
  entityId: 'entityId',
  assinaturaHash: 'assinaturaHash',
  createdAt: 'createdAt'
};

exports.Prisma.ReportSnapshotScalarFieldEnum = {
  id: 'id',
  tipo: 'tipo',
  referencia: 'referencia',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.UserPermissionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  module: 'module',
  action: 'action',
  allowed: 'allowed'
};

exports.Prisma.SystemConfigScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  description: 'description',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt'
};

exports.Prisma.StockValuationScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  custoMedio: 'custoMedio',
  updatedAt: 'updatedAt'
};

exports.Prisma.DispensacaoScalarFieldEnum = {
  id: 'id',
  produtoId: 'produtoId',
  loteId: 'loteId',
  userId: 'userId',
  validadoPorId: 'validadoPorId',
  faturaItemId: 'faturaItemId',
  faturaId: 'faturaId',
  receitaId: 'receitaId',
  quantidade: 'quantidade',
  tipoDispensacao: 'tipoDispensacao',
  isControlado: 'isControlado',
  isPsicotropico: 'isPsicotropico',
  necessitaReceita: 'necessitaReceita',
  receitaVerificada: 'receitaVerificada',
  receitaFisicaPresente: 'receitaFisicaPresente',
  receitaValida: 'receitaValida',
  validacaoDupla: 'validacaoDupla',
  motivoSaida: 'motivoSaida',
  idempotencyKey: 'idempotencyKey',
  deletedAt: 'deletedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  version: 'version'
};

exports.Prisma.FaturaAnulacaoScalarFieldEnum = {
  id: 'id',
  faturaId: 'faturaId',
  userId: 'userId',
  motivo: 'motivo',
  observacoes: 'observacoes',
  createdAt: 'createdAt'
};

exports.Prisma.FaturaItemCancelamentoScalarFieldEnum = {
  id: 'id',
  faturaItemId: 'faturaItemId',
  userId: 'userId',
  quantidade: 'quantidade',
  motivo: 'motivo',
  createdAt: 'createdAt'
};

exports.Prisma.PaymentRefundScalarFieldEnum = {
  id: 'id',
  paymentId: 'paymentId',
  userId: 'userId',
  valor: 'valor',
  metodo: 'metodo',
  motivo: 'motivo',
  createdAt: 'createdAt'
};

exports.Prisma.BusinessEventScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  entity: 'entity',
  entityId: 'entityId',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.CaixaSessaoScalarFieldEnum = {
  id: 'id',
  caixaId: 'caixaId',
  userId: 'userId',
  abertura: 'abertura',
  sistema: 'sistema',
  contado: 'contado',
  diferenca: 'diferenca',
  observacaoFecho: 'observacaoFecho',
  fechadoPorId: 'fechadoPorId',
  status: 'status',
  openedAt: 'openedAt',
  closedAt: 'closedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.StockReversalScalarFieldEnum = {
  id: 'id',
  faturaId: 'faturaId',
  faturaItemId: 'faturaItemId',
  produtoId: 'produtoId',
  loteId: 'loteId',
  userId: 'userId',
  quantidade: 'quantidade',
  motivo: 'motivo',
  createdAt: 'createdAt'
};

exports.Prisma.FinancialSummaryScalarFieldEnum = {
  id: 'id',
  periodo: 'periodo',
  ano: 'ano',
  mes: 'mes',
  dia: 'dia',
  totalVendas: 'totalVendas',
  totalCustos: 'totalCustos',
  totalDespesas: 'totalDespesas',
  lucroBruto: 'lucroBruto',
  lucroLiquido: 'lucroLiquido',
  margemLucro: 'margemLucro',
  createdAt: 'createdAt'
};

exports.Prisma.ReceitaScalarFieldEnum = {
  id: 'id',
  clienteId: 'clienteId',
  medicoNome: 'medicoNome',
  numeroReceita: 'numeroReceita',
  unidadeSanitaria: 'unidadeSanitaria',
  dataReceita: 'dataReceita',
  observacoes: 'observacoes',
  createdAt: 'createdAt'
};

exports.Prisma.LivroReceitaScalarFieldEnum = {
  id: 'id',
  receitaId: 'receitaId',
  clienteId: 'clienteId',
  faturaId: 'faturaId',
  faturaItemId: 'faturaItemId',
  dispensacaoId: 'dispensacaoId',
  produtoId: 'produtoId',
  loteId: 'loteId',
  tipoMovimento: 'tipoMovimento',
  quantidade: 'quantidade',
  saldoAnterior: 'saldoAnterior',
  saldoAtual: 'saldoAtual',
  medicoNome: 'medicoNome',
  numeroReceita: 'numeroReceita',
  dataReceita: 'dataReceita',
  origemReceita: 'origemReceita',
  idempotencyKey: 'idempotencyKey',
  observacoes: 'observacoes',
  responsavelId: 'responsavelId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  version: 'version'
};

exports.Prisma.TaxRuleScalarFieldEnum = {
  id: 'id',
  codigo: 'codigo',
  nome: 'nome',
  tipo: 'tipo',
  taxa: 'taxa',
  descricao: 'descricao',
  ativo: 'ativo',
  versao: 'versao',
  dataInicio: 'dataInicio',
  dataFim: 'dataFim',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.TenantUserRole = exports.$Enums.TenantUserRole = {
  ADMIN: 'ADMIN',
  GERENTE: 'GERENTE',
  CAIXA: 'CAIXA',
  FARMACEUTICO: 'FARMACEUTICO',
  DIRETOR_TECNICO: 'DIRETOR_TECNICO'
};

exports.TipoCaixaMovimento = exports.$Enums.TipoCaixaMovimento = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  SUPRIMENTO: 'SUPRIMENTO',
  SANGRIA: 'SANGRIA',
  ESTORNO: 'ESTORNO'
};

exports.OrigemCaixaMovimentacao = exports.$Enums.OrigemCaixaMovimentacao = {
  PEDIDO: 'PEDIDO',
  COMPRA: 'COMPRA',
  AJUSTE: 'AJUSTE',
  PAGAMENTO: 'PAGAMENTO',
  SANGRIA: 'SANGRIA',
  REFORCO: 'REFORCO',
  OUTRO: 'OUTRO'
};

exports.CategoriaDespesa = exports.$Enums.CategoriaDespesa = {
  ENERGIA: 'ENERGIA',
  AGUA: 'AGUA',
  INTERNET: 'INTERNET',
  SALARIO: 'SALARIO',
  TRANSPORTE: 'TRANSPORTE',
  MANUTENCAO: 'MANUTENCAO',
  LIMPEZA: 'LIMPEZA',
  IMPOSTO: 'IMPOSTO',
  RENDA: 'RENDA',
  COMPRA_STOCK: 'COMPRA_STOCK',
  OUTRO: 'OUTRO'
};

exports.TipoCliente = exports.$Enums.TipoCliente = {
  PACIENTE: 'PACIENTE',
  EMPRESA: 'EMPRESA',
  CONVENIO: 'CONVENIO'
};

exports.StatusConvenio = exports.$Enums.StatusConvenio = {
  ATIVO: 'ATIVO',
  SUSPENSO: 'SUSPENSO',
  CANCELADO: 'CANCELADO',
  AGUARDANDO_RENOVACAO: 'AGUARDANDO_RENOVACAO'
};

exports.TipoDispensacao = exports.$Enums.TipoDispensacao = {
  VENDA_LIVRE: 'VENDA_LIVRE',
  RECEITA_SIMPLES: 'RECEITA_SIMPLES',
  RECEITA_CONTROLADA: 'RECEITA_CONTROLADA',
  RECEITA_OBRIGATORIA: 'RECEITA_OBRIGATORIA',
  RECEITA_RETIDA: 'RECEITA_RETIDA',
  PSICOTROPICO: 'PSICOTROPICO',
  NARCOTICO: 'NARCOTICO'
};

exports.RiskLevel = exports.$Enums.RiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

exports.TipoServicoClinico = exports.$Enums.TipoServicoClinico = {
  PESO: 'PESO',
  PRESSAO_ARTERIAL: 'PRESSAO_ARTERIAL',
  TEMPERATURA: 'TEMPERATURA',
  GLICEMIA: 'GLICEMIA',
  CONSULTA: 'CONSULTA',
  INJECAO: 'INJECAO',
  CURATIVO: 'CURATIVO',
  OUTRO: 'OUTRO'
};

exports.TipoFornecedor = exports.$Enums.TipoFornecedor = {
  DISTRIBUIDOR: 'DISTRIBUIDOR',
  IMPORTADOR: 'IMPORTADOR',
  FABRICANTE: 'FABRICANTE',
  GROSSISTA: 'GROSSISTA',
  LOCAL: 'LOCAL'
};

exports.StatusCompra = exports.$Enums.StatusCompra = {
  PENDENTE: 'PENDENTE',
  RECEBIDA: 'RECEBIDA',
  CANCELADA: 'CANCELADA'
};

exports.EstadoSanitarioLote = exports.$Enums.EstadoSanitarioLote = {
  VALIDO: 'VALIDO',
  EXPIRADO: 'EXPIRADO',
  RECALL: 'RECALL'
};

exports.DisponibilidadeLote = exports.$Enums.DisponibilidadeLote = {
  DISPONIVEL: 'DISPONIVEL',
  BLOQUEADO: 'BLOQUEADO',
  INDISPONIVEL: 'INDISPONIVEL'
};

exports.TipoMovimentoSanitario = exports.$Enums.TipoMovimentoSanitario = {
  QUARENTENA: 'QUARENTENA',
  LIBERACAO: 'LIBERACAO',
  INCINERACAO: 'INCINERACAO',
  RECALL: 'RECALL',
  DEVOLUCAO_FORNECEDOR: 'DEVOLUCAO_FORNECEDOR'
};

exports.TipoMovimento = exports.$Enums.TipoMovimento = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  AJUSTE: 'AJUSTE',
  DEVOLUCAO: 'DEVOLUCAO',
  QUARENTENA: 'QUARENTENA',
  INCINERACAO: 'INCINERACAO'
};

exports.TipoAlerta = exports.$Enums.TipoAlerta = {
  ESTOQUE_BAIXO: 'ESTOQUE_BAIXO',
  PRODUTO_ESGOTADO: 'PRODUTO_ESGOTADO',
  LOTE_EXPIRADO: 'LOTE_EXPIRADO',
  LOTE_A_EXPIRAR: 'LOTE_A_EXPIRAR',
  PRECO_SUBIU: 'PRECO_SUBIU',
  SEM_FORNECEDOR: 'SEM_FORNECEDOR'
};

exports.TipoDocumentoFiscal = exports.$Enums.TipoDocumentoFiscal = {
  FT: 'FT',
  FR: 'FR',
  NC: 'NC',
  ND: 'ND'
};

exports.TipoOperacaoFiscal = exports.$Enums.TipoOperacaoFiscal = {
  TRIBUTADA: 'TRIBUTADA',
  ISENTA: 'ISENTA',
  NAO_SUJEITA: 'NAO_SUJEITA'
};

exports.TipoPagamentoFatura = exports.$Enums.TipoPagamentoFatura = {
  DINHEIRO: 'DINHEIRO',
  CARTAO: 'CARTAO',
  CREDITO_CONVENIO: 'CREDITO_CONVENIO',
  FIADO: 'FIADO',
  EMOLA: 'EMOLA',
  MPESA: 'MPESA'
};

exports.EstadoFatura = exports.$Enums.EstadoFatura = {
  RASCUNHO: 'RASCUNHO',
  EMITIDA: 'EMITIDA',
  PAGA: 'PAGA',
  PARCIAL: 'PARCIAL',
  ANULADA: 'ANULADA'
};

exports.TipoRegraFiscal = exports.$Enums.TipoRegraFiscal = {
  IVA_NORMAL: 'IVA_NORMAL',
  IVA_REDUZIDO: 'IVA_REDUZIDO',
  IVA_ISENTO: 'IVA_ISENTO',
  NAO_TRIBUTAVEL: 'NAO_TRIBUTAVEL'
};

exports.ContaStatus = exports.$Enums.ContaStatus = {
  ABERTA: 'ABERTA',
  PAGA: 'PAGA',
  PARCIAL: 'PARCIAL',
  CANCELADA: 'CANCELADA'
};

exports.MetodoPagamento = exports.$Enums.MetodoPagamento = {
  DINHEIRO: 'DINHEIRO',
  CARTAO: 'CARTAO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  CARTEIRA_MOVEL: 'CARTEIRA_MOVEL',
  EMOLA: 'EMOLA',
  MPESA: 'MPESA'
};

exports.FinancialMovementType = exports.$Enums.FinancialMovementType = {
  SALE: 'SALE',
  REFUND: 'REFUND',
  EXPENSE: 'EXPENSE',
  PURCHASE: 'PURCHASE',
  ADJUSTMENT: 'ADJUSTMENT',
  DEBT_PAYMENT: 'DEBT_PAYMENT'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  PENDENTE: 'PENDENTE',
  CONFIRMADO: 'CONFIRMADO',
  ESTORNADO: 'ESTORNADO'
};

exports.TipoMovimentoPsicotropico = exports.$Enums.TipoMovimentoPsicotropico = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  IMPORTACAO: 'IMPORTACAO'
};

exports.SystemModule = exports.$Enums.SystemModule = {
  REQUISICOES: 'REQUISICOES',
  COMPRAS: 'COMPRAS',
  PRODUTOS: 'PRODUTOS',
  LOTES: 'LOTES',
  INVENTARIO: 'INVENTARIO',
  FORNECEDORES: 'FORNECEDORES',
  CLIENTES: 'CLIENTES',
  POS: 'POS',
  RELATORIOS: 'RELATORIOS',
  UTILIZADORES: 'UTILIZADORES',
  CONFIGURACOES: 'CONFIGURACOES',
  FATURAS: 'FATURAS',
  CAIXA: 'CAIXA',
  ESTOQUE: 'ESTOQUE',
  PSICOTROPICOS: 'PSICOTROPICOS',
  AUDITORIA: 'AUDITORIA'
};

exports.PermissionAction = exports.$Enums.PermissionAction = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CANCEL: 'CANCEL',
  EXPORT: 'EXPORT',
  CREATE_LOTE: 'CREATE_LOTE',
  ADJUST_STOCK: 'ADJUST_STOCK',
  CLOSE_SHIFT: 'CLOSE_SHIFT'
};

exports.StatusInventario = exports.$Enums.StatusInventario = {
  ABERTO: 'ABERTO',
  EM_CONTAGEM: 'EM_CONTAGEM',
  RECONCILIADO: 'RECONCILIADO',
  CANCELADO: 'CANCELADO'
};

exports.TipoRequisicao = exports.$Enums.TipoRequisicao = {
  COMPRA: 'COMPRA',
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA'
};

exports.StatusRequisicao = exports.$Enums.StatusRequisicao = {
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  REJEITADA: 'REJEITADA',
  CONCLUIDA: 'CONCLUIDA',
  CANCELADA: 'CANCELADA'
};

exports.TipoRelatorioSanitario = exports.$Enums.TipoRelatorioSanitario = {
  MAPA_MENSAL_PSICOTROPICOS: 'MAPA_MENSAL_PSICOTROPICOS',
  MAPA_MENSAL_NARCOTICOS: 'MAPA_MENSAL_NARCOTICOS',
  RELATORIO_EXPIRADOS: 'RELATORIO_EXPIRADOS',
  RELATORIO_QUARENTENA: 'RELATORIO_QUARENTENA',
  RELATORIO_INCINERACAO: 'RELATORIO_INCINERACAO',
  BALANCO_ESTOQUE_ANUAL: 'BALANCO_ESTOQUE_ANUAL'
};

exports.SessaoCaixaStatus = exports.$Enums.SessaoCaixaStatus = {
  ABERTA: 'ABERTA',
  FECHADA: 'FECHADA'
};

exports.TipoMovimentoReceita = exports.$Enums.TipoMovimentoReceita = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  CANCELAMENTO: 'CANCELAMENTO',
  AJUSTE: 'AJUSTE'
};

exports.OrigemReceita = exports.$Enums.OrigemReceita = {
  FISICA: 'FISICA',
  DIGITAL: 'DIGITAL',
  SISTEMA_INTERNO: 'SISTEMA_INTERNO'
};

exports.Prisma.ModelName = {
  User: 'User',
  Terminal: 'Terminal',
  Caixa: 'Caixa',
  CaixaMovimento: 'CaixaMovimento',
  Cliente: 'Cliente',
  Empresa: 'Empresa',
  ConvenioContrato: 'ConvenioContrato',
  Produto: 'Produto',
  ProdutoRegulacao: 'ProdutoRegulacao',
  ProdutoClassificacaoEvento: 'ProdutoClassificacaoEvento',
  Servico: 'Servico',
  Fornecedor: 'Fornecedor',
  ProdutoFornecedor: 'ProdutoFornecedor',
  Compra: 'Compra',
  CompraItem: 'CompraItem',
  Lote: 'Lote',
  LoteMovimentoSanitario: 'LoteMovimentoSanitario',
  Incineracao: 'Incineracao',
  IncineracaoItem: 'IncineracaoItem',
  EstoqueMovimento: 'EstoqueMovimento',
  HistoricoPreco: 'HistoricoPreco',
  AlertaEstoque: 'AlertaEstoque',
  Fatura: 'Fatura',
  FaturaItem: 'FaturaItem',
  ContaReceber: 'ContaReceber',
  ContaReceberPagamento: 'ContaReceberPagamento',
  ContaPagar: 'ContaPagar',
  EstoqueReserva: 'EstoqueReserva',
  FinancialMovement: 'FinancialMovement',
  Pagamento: 'Pagamento',
  LivroPsicotropico: 'LivroPsicotropico',
  RolePermission: 'RolePermission',
  StockBalance: 'StockBalance',
  Inventario: 'Inventario',
  InventarioItem: 'InventarioItem',
  Requisicao: 'Requisicao',
  RequisicaoItem: 'RequisicaoItem',
  CashBalance: 'CashBalance',
  AuditLog: 'AuditLog',
  SanitarioReport: 'SanitarioReport',
  DigitalSignature: 'DigitalSignature',
  ReportSnapshot: 'ReportSnapshot',
  UserPermission: 'UserPermission',
  SystemConfig: 'SystemConfig',
  StockValuation: 'StockValuation',
  Dispensacao: 'Dispensacao',
  FaturaAnulacao: 'FaturaAnulacao',
  FaturaItemCancelamento: 'FaturaItemCancelamento',
  PaymentRefund: 'PaymentRefund',
  BusinessEvent: 'BusinessEvent',
  CaixaSessao: 'CaixaSessao',
  StockReversal: 'StockReversal',
  FinancialSummary: 'FinancialSummary',
  Receita: 'Receita',
  LivroReceita: 'LivroReceita',
  TaxRule: 'TaxRule'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
