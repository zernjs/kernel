# 🎯 Simple Plugin - Boilerplate Minimalista

> **Estrutura minimalista para plugins Zern - perfeita para começar rapidamente**

## 📦 Estrutura

```
simple-plugin/
├── README.md           # Este arquivo
├── src/
│   ├── index.ts       # Public API & exports
│   ├── plugin.ts      # Plugin definition
│   ├── types.ts       # TypeScript interfaces
│   └── config.ts      # Configuration & defaults
```

Apenas **4 arquivos** - simples, claro e poderoso!

---

## 🚀 Uso Rápido

### Com Kernel

```typescript
import { createKernel } from '@zern/kernel';
import { counterPlugin } from 'simple-plugin';

const kernel = await createKernel().use(counterPlugin).start();

const counter = kernel.get('counter');
counter.increment(); // 1
counter.increment(); // 2
```

### Direct API (sem kernel)

```typescript
import { increment, decrement, getValue } from 'simple-plugin';

increment(); // 1
increment(); // 2
getValue(); // 2
```

---

## ✨ Features Demonstradas

- ✅ Plugin setup básico
- ✅ Metadata customizada
- ✅ Lifecycle hooks (`onInit`, `onReady`, `onShutdown`)
- ✅ Direct API exports
- ✅ TypeScript type-safe
- ✅ Configuração simples

---

## 📝 Personalizando

1. **Renomeie** `counter` para o nome do seu plugin
2. **Modifique** `types.ts` com suas interfaces
3. **Implemente** sua lógica no `plugin.ts`
4. **Exporte** métodos no `index.ts`

---

## 🎓 Quando Usar Este Boilerplate

✅ **USE quando:**

- Criar um plugin simples
- Prototipar rapidamente
- Aprender o Zern Kernel
- Plugin sem muitas dependências

❌ **NÃO USE quando:**

- Projeto grande e complexo
- Múltiplas camadas de abstração
- Vários services e validators
- Neste caso, use o **math-plugin** (boilerplate opinado)

---

## 📚 Próximos Passos

- 📖 Veja o `math-plugin/` para estrutura completa e opinada
- 🎭 Adicione proxies para interceptar outros plugins
- 🔗 Use `.extend()` para adicionar funcionalidades a outros plugins
- 🧪 Escreva testes para seus métodos

---

**Divirta-se criando plugins! 🎉**
