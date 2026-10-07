import type { RequestHandler } from "express";
import type { ZodType, z } from "zod";
import { HttpError } from "../utils/http-error.js";

export type TRequestSchemas<
  TParams extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
> = {
  params?: TParams;
  query?: TQuery;
  body?: TBody;
};

export type TValidationIssue = {
  path: string;
  message: string;
  code: string;
};

type TParsed<TSchema, TFallback> = TSchema extends ZodType ? z.output<TSchema> : TFallback;

const REQUEST_PARTS = ["params", "query", "body"] as const;

export function RequestValidationMiddleware<
  TParams extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
>(
  schemas: TRequestSchemas<TParams, TQuery, TBody>,
): RequestHandler<
  TParsed<TParams, Record<string, string>>,
  unknown,
  TParsed<TBody, unknown>,
  TParsed<TQuery, Record<string, unknown>>
> {
  return async (req, _res, next) => {
    const issues: TValidationIssue[] = [];

    for (const part of REQUEST_PARTS) {
      const schema = schemas[part];
      if (!schema) {
        continue;
      }
      const result = await schema.safeParseAsync(req[part]);
      if (!result.success) {
        issues.push(
          ...result.error.issues.map((issue) => ({
            path: [part, ...issue.path.map(String)].join("."),
            message: issue.message,
            code: issue.code,
          })),
        );
        continue;
      }
      Object.defineProperty(req, part, { value: result.data, writable: true, enumerable: true });
    }

    if (issues.length > 0) {
      return next(
        HttpError.badRequest("Request validation failed", {
          code: "VALIDATION_ERROR",
          details: issues,
        }),
      );
    }
    next();
  };
}
