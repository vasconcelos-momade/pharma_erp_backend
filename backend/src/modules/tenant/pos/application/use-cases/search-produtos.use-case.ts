import { POS_DEFAULT_PAGE_SIZE } from "../../domain/pos-catalog.constants";
import { PosProductMapper } from "../services/pos-product.mapper";
import {
  ProductSearchService,
  type ProductSearchParams,
} from "../services/product-search.service";

const emptyBarcodeResult = {
  items: [] as Record<string, unknown>[],
  page: 1,
  pageSize: 1,
  hasMore: false,
};

/** Orquestra pesquisa, stock, FEFO, preço e mapeamento do catálogo POS. */
export class SearchProdutosUseCase {
  constructor(
    private readonly productSearch = new ProductSearchService(),
    private readonly posProductMapper = new PosProductMapper(),
  ) {}

  async execute(params?: ProductSearchParams) {
    const barcode = params?.barcode?.trim();

    if (barcode) {
      const mapped = await this.productSearch.findByBarcode(
        barcode,
        this.posProductMapper,
      );
      if (!mapped) {
        return emptyBarcodeResult;
      }

      return {
        items: [mapped],
        page: 1,
        pageSize: 1,
        hasMore: false,
      };
    }

    return this.productSearch.search(
      {
        query: params?.query,
        categoriaId: params?.categoriaId,
        page: params?.page,
        pageSize: params?.pageSize ?? POS_DEFAULT_PAGE_SIZE,
      },
      this.posProductMapper,
    );
  }
}
