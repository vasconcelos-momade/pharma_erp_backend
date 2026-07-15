import { describe, expect, test } from "bun:test";
import {
  resolveAcoesSanitariasPermitidas,
  resolveEstadoSanitarioEfetivo,
} from "./lote-sanitario-policy";

describe("lote-sanitario-policy", () => {
  test("VALIDO permite quarentena, incineração, recall e devolução", () => {
    const lote = {
      estadoSanitario: "VALIDO",
      quantidadeQuarentena: 0,
      quantidadeIncinerada: 0,
      stockBalance: { quantidadeTotal: 100, quantidadeDisponivel: 100 },
    };
    expect(resolveEstadoSanitarioEfetivo(lote)).toBe("VALIDO");
    expect(resolveAcoesSanitariasPermitidas(lote)).toEqual([
      "QUARENTENA",
      "INCINERACAO",
      "RECALL",
      "DEVOLUCAO_FORNECEDOR",
    ]);
  });

  test("QUARENTENA só permite liberação e incineração", () => {
    const lote = {
      estadoSanitario: "VALIDO",
      quantidadeQuarentena: 20,
      quantidadeIncinerada: 0,
      stockBalance: { quantidadeTotal: 100, quantidadeDisponivel: 80 },
    };
    expect(resolveEstadoSanitarioEfetivo(lote)).toBe("QUARENTENA");
    expect(resolveAcoesSanitariasPermitidas(lote)).toEqual([
      "LIBERACAO",
      "INCINERACAO",
    ]);
  });

  test("INCINERADO bloqueia qualquer movimentação", () => {
    const lote = {
      estadoSanitario: "VALIDO",
      quantidadeQuarentena: 0,
      quantidadeIncinerada: 50,
      stockBalance: { quantidadeTotal: 0, quantidadeDisponivel: 0 },
    };
    expect(resolveEstadoSanitarioEfetivo(lote)).toBe("INCINERADO");
    expect(resolveAcoesSanitariasPermitidas(lote)).toEqual([]);
  });

  test("RECALL só permite incineração", () => {
    const lote = {
      estadoSanitario: "RECALL",
      quantidadeQuarentena: 0,
      quantidadeIncinerada: 0,
      stockBalance: { quantidadeTotal: 10, quantidadeDisponivel: 10 },
    };
    expect(resolveEstadoSanitarioEfetivo(lote)).toBe("RECALL");
    expect(resolveAcoesSanitariasPermitidas(lote)).toEqual(["INCINERACAO"]);
  });
});
