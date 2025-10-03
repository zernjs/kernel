# 🧮 Math Plugin - Boilerplate Opinado

> **Estrutura completa e opinada para plugins Zern profissionais e escaláveis**

## 📦 Estrutura

```
math-plugin/
├── README.md                           # Este arquivo
├── src/
│   ├── index.ts                        # Public API
│   ├── plugin.ts                       # Plugin core
│   ├── api-factory.ts                  # API creation logic
│   │
│   ├── types/                          # Type System
│   │   ├── index.ts
│   │   ├── api.types.ts                # Public API interfaces
│   │   ├── config.types.ts             # Configuration
│   │   └── domain.types.ts             # Domain models
│   │
│   ├── config/                         # Configuration
│   │   ├── index.ts
│   │   ├── defaults.ts                 # Default values
│   │   └── constants.ts                # Constants
│   │
│   ├── errors/                         # Custom Errors
│   │   ├── index.ts
│   │   ├── math.errors.ts              # Error classes
│   │   └── error-codes.ts              # Error codes enum
│   │
│   ├── validators/                     # Validation Layer
│   │   ├── index.ts
│   │   └── number.validator.ts         # Number validation
│   │
│   ├── services/                       # Business Logic
│   │   ├── index.ts
│   │   ├── math.service.ts             # Core operations
│   │   └── history.service.ts          # Operation history
│   │
│   ├── utils/                          # Utilities
│   │   ├── index.ts
│   │   └── formatters.ts               # Number formatters
│   │
│   └── lifecycle/                      # Lifecycle Hooks
│       ├── index.ts
│       ├── on-init.ts
│       ├── on-ready.ts
│       └── on-shutdown.ts
```

---

## 🏗️ Arquitetura

### **Separation of Concerns**

| Layer              | Responsibility     | Testable? |
| ------------------ | ------------------ | --------- |
| **plugin.ts**      | Orchestration only | ❌        |
| **api-factory.ts** | API assembly       | ✅        |
| **services/**      | Business logic     | ✅✅✅    |
| **validators/**    | Input validation   | ✅✅✅    |
| **errors/**        | Error handling     | ✅✅      |
| **utils/**         | Helpers            | ✅✅✅    |
| **lifecycle/**     | Plugin lifecycle   | ✅        |

---

## 🚀 Uso

### Com Kernel

```typescript
import { createKernel } from '@zern/kernel';
import { mathPlugin } from 'math-plugin';

const kernel = await createKernel().use(mathPlugin).start();

const math = kernel.get('math');
math.add(2, 3); // 5
```

### Direct API

```typescript
import { add, subtract, multiply } from 'math-plugin';

add(2, 3); // 5
subtract(10, 4); // 6
```

---

## ✨ Features Demonstradas

### **Core Features**

- ✅ Plugin com metadata customizada
- ✅ Lifecycle hooks completos
- ✅ Services organizados por responsabilidade
- ✅ Validators reutilizáveis
- ✅ Custom errors com códigos
- ✅ Direct API exports

### **Advanced Features**

- ✅ API Factory pattern
- ✅ Dependency injection via services
- ✅ Type-safe error handling
- ✅ Operation history tracking
- ✅ Configuração runtime

---

## 📁 Guia de Organização

### **Quando criar um novo arquivo?**

#### **`services/`**

✅ Crie quando:

- Nova responsabilidade de negócio
- Lógica que precisa ser testada isoladamente
- Funcionalidade que pode crescer

```typescript
// ✅ BOM: Um service por responsabilidade
services / math.service.ts; // Operações matemáticas
services / history.service.ts; // Histórico de operações
services / statistics.service.ts; // Estatísticas

// ❌ RUIM: Tudo em um arquivo
services / everything.service.ts;
```

#### **`validators/`**

✅ Crie quando:

- Validação complexa e reutilizável
- Múltiplas regras de negócio
- Validação usada em vários lugares

#### **`errors/`**

✅ Crie quando:

- Erro específico do domínio
- Precisa de contexto adicional
- Tratamento especial

#### **`utils/`**

✅ Crie quando:

- Função pura e genérica
- Pode ser usada em qualquer lugar
- Não tem lógica de negócio

---

## 🎯 Quando Usar Este Boilerplate

✅ **USE quando:**

- Projeto grande e complexo
- Múltiplas responsabilidades
- Precisa escalar
- Time de desenvolvedores
- Código de produção

❌ **NÃO USE quando:**

- Plugin simples
- Protótipo rápido
- Aprendendo o framework
- Neste caso, use o **simple-plugin** (boilerplate minimalista)

---

## 🔧 Personalizando

### 1. **Defina seus tipos** (`types/`)

```typescript
// types/api.types.ts
export interface YourAPI {
  method1: () => void;
  method2: () => void;
}
```

### 2. **Configure defaults** (`config/`)

```typescript
// config/defaults.ts
export const DEFAULT_CONFIG = {
  // suas configurações
};
```

### 3. **Crie seus services** (`services/`)

```typescript
// services/your.service.ts
export class YourService {
  // sua lógica
}
```

### 4. **Monte a API** (`api-factory.ts`)

```typescript
export function createYourAPI(ctx) {
  const service = new YourService();
  return {
    method1: () => service.method1(),
  };
}
```

### 5. **Configure o plugin** (`plugin.ts`)

```typescript
export const yourPlugin = plugin('your', '1.0.0')
  .metadata({
    /* ... */
  })
  .setup(createYourAPI);
```

---

## 📊 Comparação com Simple Plugin

| Feature              | Simple Plugin   | Math Plugin (Este) |
| -------------------- | --------------- | ------------------ |
| **Arquivos**         | 4               | ~20                |
| **Complexidade**     | Baixa           | Alta               |
| **Escalabilidade**   | ⭐⭐            | ⭐⭐⭐⭐⭐         |
| **Testabilidade**    | ⭐⭐⭐          | ⭐⭐⭐⭐⭐         |
| **Manutenibilidade** | ⭐⭐⭐          | ⭐⭐⭐⭐⭐         |
| **Learning Curve**   | Fácil           | Moderado           |
| **Use Case**         | Plugins simples | Produção/Times     |

---

## 🎓 Princípios desta Arquitetura

1. **Single Responsibility** - Cada arquivo tem UMA responsabilidade
2. **Dependency Injection** - Services recebem dependências via constructor
3. **Pure Functions** - Validators e utils são funções puras
4. **Type Safety** - TypeScript em TUDO
5. **Testability** - Tudo pode ser testado isoladamente
6. **Separation of Concerns** - Camadas bem definidas
7. **DRY** - Não repita código (use utils e validators)

---

**Boa sorte com seu plugin profissional! 🚀**
