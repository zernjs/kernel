import { createKernel, definePlugin } from '../src';

/**
 * Exemplo 03: Augmentation (Extensão de Plugins)
 *
 * O recurso mais poderoso do Zern Kernel.
 * Um plugin pode adicionar métodos e propriedades a outro plugin existente.
 * O TypeScript entende isso automaticamente!
 */

// 1. Plugin Base: Usuários
const usersPlugin = definePlugin({
  name: 'users',
  version: '1.0.0',
  setup: () => {
    const users = ['Alice', 'Bob'];

    return {
      getAll: (): string[] => users,
      add: (name: string): number => users.push(name),
    };
  },
});

// 2. Plugin de Autenticação (Estende Usuários)
// Este plugin adiciona o método `login` e `isAdmin` ao plugin `users`!
const authPlugin = definePlugin({
  name: 'auth',
  version: '1.0.0',
  dependencies: [usersPlugin],
  setup: ctx => {
    return {
      // API do próprio plugin Auth
      api: {
        getCurrentUser: (): string => 'Alice',
      },
      // Extensões para outros plugins
      extensions: {
        users: {
          // Novo método injetado em 'users'
          login: (name: string): boolean => {
            const exists = ctx.plugins.users.getAll().includes(name);
            console.log(exists ? `Login: ${name}` : `User not found: ${name}`);
            return exists;
          },
          // Outro método injetado
          isAdmin: (name: string): boolean => name === 'Alice',
        },
      },
    };
  },
});

async function main(): Promise<void> {
  console.log('--- Iniciando Exemplo de Augmentation ---');

  const app = await createKernel().use(usersPlugin).use(authPlugin).start();

  // A Mágica Acontece Aqui:
  // O método .login() NÃO existia no usersPlugin original,
  // mas foi injetado pelo authPlugin e o TypeScript sabe disso!

  const isLogged = app.plugins.users.login('Bob'); // Injetado!
  const isAdmin = app.plugins.users.isAdmin('Bob'); // Injetado!
  const allUsers = app.plugins.users.getAll(); // Original

  console.log('Is Logged:', isLogged);
  console.log('Is Admin:', isAdmin);
  console.log('All Users:', allUsers);
}

main().catch(console.error);
