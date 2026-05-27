import {
  getTenantCatalogVersion,
  type TenantCatalogVersion,
} from "../services/catalog-version.service";

export class GetCatalogVersionUseCase {
  async execute(): Promise<TenantCatalogVersion> {
    return getTenantCatalogVersion();
  }
}
