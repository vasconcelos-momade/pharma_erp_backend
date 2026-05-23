export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS";

export type RouteParams = Record<string, string>;
export type RouteState = Record<string, unknown>;

export interface RouteContext {
  req: Request;
  url: URL;
  params: RouteParams;
  state: RouteState;
  requestId: string;
}

export type RouteHandler = (context: RouteContext) => Promise<Response | unknown> | Response | unknown;
export type RouteNext = () => Promise<Response>;
export type RouteMiddleware = (context: RouteContext, next: RouteNext) => Promise<Response>;

type RegisteredRoute = {
  method: HttpMethod;
  path: string;
  matcher: RegExp;
  paramNames: string[];
  middlewares: RouteMiddleware[];
  handler: RouteHandler;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePath(path: string): { matcher: RegExp; paramNames: string[] } {
  const segments = path.split("/").filter(Boolean);
  const paramNames: string[] = [];

  const expression = segments
    .map((segment) => {
      if (segment.startsWith(":")) {
        paramNames.push(segment.slice(1));
        return "([^/]+)";
      }

      return escapeRegExp(segment);
    })
    .join("/");

  return {
    matcher: new RegExp(`^/${expression}$`),
    paramNames,
  };
}

async function compose(
  context: RouteContext,
  middlewares: RouteMiddleware[],
  handler: RouteHandler,
): Promise<Response> {
  let index = -1;

  async function dispatch(position: number): Promise<Response> {
    if (position <= index) {
      throw new Error("next() chamado múltiplas vezes para a mesma middleware.");
    }

    index = position;

    const middleware = middlewares[position];
    if (middleware) {
      return middleware(context, () => dispatch(position + 1));
    }

    const result = await handler(context);
    if (result instanceof Response) {
      return result;
    }

    return Response.json(result ?? null);
  }

  return dispatch(0);
}

export class Router {
  private readonly routes: RegisteredRoute[] = [];
  private readonly globalMiddlewares: RouteMiddleware[] = [];

  use(...middlewares: RouteMiddleware[]): void {
    this.globalMiddlewares.push(...middlewares);
  }

  register(method: HttpMethod, path: string, ...handlers: [...RouteMiddleware[], RouteHandler]): void {
    const handler = handlers[handlers.length - 1] as RouteHandler;
    const middlewares = handlers.slice(0, -1) as RouteMiddleware[];
    const { matcher, paramNames } = compilePath(path);

    this.routes.push({
      method,
      path,
      matcher,
      paramNames,
      middlewares,
      handler,
    });
  }

  get(path: string, ...handlers: [...RouteMiddleware[], RouteHandler]): void {
    this.register("GET", path, ...handlers);
  }

  post(path: string, ...handlers: [...RouteMiddleware[], RouteHandler]): void {
    this.register("POST", path, ...handlers);
  }

  put(path: string, ...handlers: [...RouteMiddleware[], RouteHandler]): void {
    this.register("PUT", path, ...handlers);
  }

  patch(path: string, ...handlers: [...RouteMiddleware[], RouteHandler]): void {
    this.register("PATCH", path, ...handlers);
  }

  delete(path: string, ...handlers: [...RouteMiddleware[], RouteHandler]): void {
    this.register("DELETE", path, ...handlers);
  }

  options(path: string, ...handlers: [...RouteMiddleware[], RouteHandler]): void {
    this.register("OPTIONS", path, ...handlers);
  }

  async handle(req: Request, url = new URL(req.url)): Promise<Response | null> {
    for (const route of this.routes) {
      if (route.method !== req.method) {
        continue;
      }

      const match = url.pathname.match(route.matcher);
      if (!match) {
        continue;
      }

      const params = route.paramNames.reduce<RouteParams>((accumulator, paramName, index) => {
        accumulator[paramName] = decodeURIComponent(match[index + 1] ?? "");
        return accumulator;
      }, {});

      return compose(
        {
          req,
          url,
          params,
          state: {},
          requestId: crypto.randomUUID(),
        },
        [...this.globalMiddlewares, ...route.middlewares],
        route.handler,
      );
    }

    return null;
  }
}
