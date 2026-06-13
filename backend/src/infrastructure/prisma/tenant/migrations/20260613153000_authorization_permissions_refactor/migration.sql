ALTER TABLE `role_permissions`
  MODIFY `module` ENUM(
    'REQUISICOES',
    'COMPRAS',
    'PRODUTOS',
    'LOTES',
    'INVENTARIO',
    'FORNECEDORES',
    'CLIENTES',
    'POS',
    'RELATORIOS',
    'UTILIZADORES',
    'CONFIGURACOES',
    'FATURAS',
    'CAIXA',
    'ESTOQUE',
    'PSICOTROPICOS',
    'AUDITORIA'
  ) NOT NULL,
  MODIFY `action` ENUM(
    'VIEW',
    'CREATE',
    'UPDATE',
    'EDIT',
    'DELETE',
    'APPROVE',
    'REJECT',
    'CANCEL',
    'EXPORT',
    'CREATE_LOTE',
    'ADJUST_STOCK',
    'CLOSE_SHIFT'
  ) NOT NULL;

ALTER TABLE `user_permissions`
  MODIFY `module` ENUM(
    'REQUISICOES',
    'COMPRAS',
    'PRODUTOS',
    'LOTES',
    'INVENTARIO',
    'FORNECEDORES',
    'CLIENTES',
    'POS',
    'RELATORIOS',
    'UTILIZADORES',
    'CONFIGURACOES',
    'FATURAS',
    'CAIXA',
    'ESTOQUE',
    'PSICOTROPICOS',
    'AUDITORIA'
  ) NOT NULL,
  MODIFY `action` ENUM(
    'VIEW',
    'CREATE',
    'UPDATE',
    'EDIT',
    'DELETE',
    'APPROVE',
    'REJECT',
    'CANCEL',
    'EXPORT',
    'CREATE_LOTE',
    'ADJUST_STOCK',
    'CLOSE_SHIFT'
  ) NOT NULL;
