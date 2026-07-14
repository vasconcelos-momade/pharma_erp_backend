import {
  createTerminalSchema,
  searchTerminalsQuerySchema,
  updateTerminalSchema,
} from "../../application/dto/terminal.dto";
import { TerminalService } from "../../application/terminal.service";
import {
  parseJsonBody,
  parseSearchParams,
} from "../../../../../shared/http/request-validation";
import { controllerErrorResponse } from "../../../../../shared/http/controller-error";

export class TerminalsController {
  private service = new TerminalService();

  private serialize(data: unknown) {
    return JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  async search(req: Request) {
    try {
      const url = new URL(req.url);
      const params = parseSearchParams(url, searchTerminalsQuerySchema);
      const result = await this.service.search({
        query: params.q,
        page: params.page,
        pageSize: params.pageSize,
        includeInactive: params.includeInactive,
      });
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 500);
    }
  }

  async get(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const id = parts[parts.length - 1];
      const result = await this.service.get(id);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error, 404);
    }
  }

  async create(req: Request) {
    try {
      const body = await parseJsonBody(req, createTerminalSchema);
      const result = await this.service.create(body);
      return Response.json(this.serialize(result), { status: 201 });
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async update(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const id = parts[parts.length - 1];
      const body = await parseJsonBody(req, updateTerminalSchema);
      const result = await this.service.update(id, body);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }

  async delete(req: Request) {
    try {
      const parts = new URL(req.url).pathname.split("/");
      const id = parts[parts.length - 1];
      const result = await this.service.delete(id);
      return Response.json(this.serialize(result));
    } catch (error: unknown) {
      return controllerErrorResponse(error);
    }
  }
}
