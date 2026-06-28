import { ClienteRepository } from "../../infrastructure/repositories/cliente.repository";
import type { CreateClienteDTO, UpdateClienteDTO } from "../dto/cliente.dto";

export class ClienteService {
  private repo = new ClienteRepository();

  create(data: CreateClienteDTO, userId: string) {
    return this.repo.create(data, BigInt(userId));
  }

  update(id: string, data: UpdateClienteDTO, userId: string) {
    return this.repo.update(BigInt(id), data, BigInt(userId));
  }

  delete(id: string, userId: string) {
    return this.repo.softDelete(BigInt(id), BigInt(userId));
  }

  search(filters: Parameters<ClienteRepository["search"]>[0]) {
    return this.repo.search(filters);
  }

  get(id: string) {
    return this.repo.getById(BigInt(id));
  }

  getDashboard() {
    return this.repo.getDashboard();
  }

  listFaturas(clienteId: string, page?: number, pageSize?: number) {
    return this.repo.listFaturas(BigInt(clienteId), page, pageSize);
  }

  listContasReceber(clienteId: string, page?: number, pageSize?: number) {
    return this.repo.listContasReceber(BigInt(clienteId), page, pageSize);
  }

  listReceitas(clienteId: string, page?: number, pageSize?: number) {
    return this.repo.listReceitas(BigInt(clienteId), page, pageSize);
  }

  listAudit(clienteId: string, page?: number, pageSize?: number) {
    return this.repo.listAuditLogs(BigInt(clienteId), page, pageSize);
  }
}
