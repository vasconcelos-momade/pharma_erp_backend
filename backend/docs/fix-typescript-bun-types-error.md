# Fix: "Cannot find type definition file for 'bun-types'"

## Problema
O erro "Cannot find type definition file for 'bun-types'" aparecia no IDE porque:
1. O projeto usava `bun-types` que é o pacote antigo (agora o Bun recomenda `@types/bun`)
2. O `node_modules` no host não tinha as dependências de tipo corretas
3. O `tsconfig.json` não estava configurado corretamente para o Bun

## Passos da Solução

### 1. Atualizar `package.json`
Troque `bun-types` por `@types/bun` (o pacote oficial recomendado):
```json
{
  "devDependencies": {
    "@types/bun": "latest" // Anteriormente era "bun-types": "latest"
  }
}
```

### 2. Atualizar `tsconfig.json`
Configuração oficial do Bun (verificado na [documentação do Bun](https://bun.sh/docs/quickstart)):
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "composite": true,
    "strict": true,
    "downlevelIteration": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": true,
    "typeRoots": ["./node_modules/@types"],
    "types": ["bun"], // Anteriormente era ["bun-types"]
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "prisma/**/*"],
  "exclude": ["node_modules"]
}
```

### 3. Instalar dependências no container
Execute no diretório `pharma_erp_backend`:
```bash
docker exec skalway_pharm_backend bun install
```

### 4. Resolver `zod` e dependências no IDE (host)

O runtime no Docker resolve `zod` após `bun install` no container. Se o IDE no **host** marca `Cannot find module 'zod'`:

```bash
cd pharma_erp_backend/backend
bun install
```

Ou no container:

```bash
docker exec skalway_pharm_backend bun install
```

O `tsconfig.json` deve usar `typeRoots` apenas em `./node_modules/@types` (evitar pasta `local_types` inexistente).

**Zod v4:** o projeto usa `zod@^4` (`z.looseObject`, etc.). Não fazer downgrade para v3 sem alterar os schemas.

## Arquivos Alterados
1. `/backend/package.json`: `@types/bun` e `zod`
2. `/backend/tsconfig.json`: `typeRoots` em `node_modules/@types`

## Verificação
```bash
docker exec skalway_pharm_backend bun -e "import { z } from 'zod'; console.log(z.string().parse('ok'))"
```
