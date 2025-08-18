import { KernelRepository, KernelRepositoryError } from '../../domain/kernel/kernel.repository';
import { KernelEntity } from '../../domain/kernel/kernel.entity';
import { KernelId } from '../../shared/types/common.types';
import { Result } from '../../shared/types/result.types';

/**
 * Implementação em memória do repositório de kernels.
 * Em um ambiente real, isso seria conectado a um banco de dados ou sistema de arquivos.
 */
export class InMemoryKernelRepository implements KernelRepository {
  private readonly kernels = new Map<KernelId, KernelEntity>();

  async save(kernel: KernelEntity): Promise<Result<void, KernelRepositoryError>> {
    try {
      this.kernels.set(kernel.id, kernel);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: KernelRepositoryError.saveError(
          kernel.id,
          error instanceof Error ? error.message : 'Unknown error'
        ),
      };
    }
  }

  async findById(id: KernelId): Promise<Result<KernelEntity | null, KernelRepositoryError>> {
    const kernel = this.kernels.get(id);
    if (!kernel) {
      return {
        success: false,
        error: KernelRepositoryError.notFound(id),
      };
    }
    return { success: true, data: kernel };
  }

  async findAll(): Promise<Result<readonly KernelEntity[], KernelRepositoryError>> {
    const allKernels = Array.from(this.kernels.values());
    return { success: true, data: allKernels };
  }

  async remove(id: KernelId): Promise<Result<void, KernelRepositoryError>> {
    if (!this.kernels.has(id)) {
      return {
        success: false,
        error: KernelRepositoryError.notFound(id),
      };
    }
    this.kernels.delete(id);
    return { success: true, data: undefined };
  }

  async exists(id: KernelId): Promise<Result<boolean, KernelRepositoryError>> {
    return { success: true, data: this.kernels.has(id) };
  }

  async findActive(): Promise<Result<KernelEntity | null, KernelRepositoryError>> {
    // Em uma implementação real, isso seria armazenado separadamente
    // Por simplicidade, retornamos o primeiro kernel se existir
    const kernels = Array.from(this.kernels.values());
    const activeKernel = kernels.length > 0 ? kernels[0] : null;
    return { success: true, data: activeKernel };
  }

  async setActive(id: KernelId): Promise<Result<void, KernelRepositoryError>> {
    if (!this.kernels.has(id)) {
      return {
        success: false,
        error: KernelRepositoryError.notFound(id),
      };
    }
    // Em uma implementação real, isso marcaria o kernel como ativo
    // Por simplicidade, apenas verificamos se existe
    return { success: true, data: undefined };
  }
}
