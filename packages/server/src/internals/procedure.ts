/* eslint-disable @typescript-eslint/no-explicit-any */
import { assertNotBrowser } from '../assertNotBrowser';
import { ProcedureType } from '../router';
import { TRPCError } from '../TRPCError';
import { getErrorFromUnknown } from './errors';
import { MiddlewareFunction, middlewareMarker } from './middlewares';
import { wrapCallSafe } from './wrapCallSafe';
assertNotBrowser();

export type ProcedureParserZodEsque<T> = {
  parse: (input: unknown) => T;
};

export type ProcedureParserSuperstructEsque<T> = {
  create: (input: unknown) => T;
};

export type ProcedureParserCustomValidatorEsque<T> = (
  input: unknown,
) => T | Promise<T>;

export type ProcedureParserYupEsque<T> = {
  validateSync: (input: unknown) => T;
};
export type ProcedureParser<T> =
  | ProcedureParserYupEsque<T>
  | ProcedureParserSuperstructEsque<T>
  | ProcedureParserCustomValidatorEsque<T>
  | ProcedureParserZodEsque<T>;

export type ProcedureResolver<TContext, TInput, TOutput> = (opts: {
  ctx: TContext;
  input: TInput;
  type: ProcedureType;
}) => Promise<TOutput> | TOutput;

interface ProcedureOptions<TContext, TInput, TOutput> {
  middlewares: Array<MiddlewareFunction<any, any>>;
  resolver: ProcedureResolver<TContext, TInput, TOutput>;
  inputParser: ProcedureParser<TInput>;
  outputParser: ProcedureParser<TOutput> | undefined;
}

/**
 * @internal
 */
export interface ProcedureCallOptions<TContext> {
  ctx: TContext;
  rawInput: unknown;
  path: string;
  type: ProcedureType;
}

type ParseFn<T> = (value: unknown) => T | Promise<T>;
function getParseFn<T>(_parser: ProcedureParser<T>): ParseFn<T> {
  const parser = _parser as any;

  if (typeof parser === 'function') {
    // ProcedureParserCustomValidatorEsque
    return parser;
  }

  if (typeof parser.parseAsync === 'function') {
    // ProcedureParserZodEsque
    return parser.parseAsync.bind(parser);
  }

  if (typeof parser.parse === 'function') {
    // ProcedureParserZodEsque
    return parser.parse.bind(parser);
  }

  if (typeof parser.validateSync === 'function') {
    // ProcedureParserYupEsque
    return parser.validateSync.bind(parser);
  }

  if (typeof parser.create === 'function') {
    // ProcedureParserSuperstructEsque
    return parser.create.bind(parser);
  }

  throw new Error('Could not find a validator fn');
}

/**
 * @internal
 */
export class Procedure<TInputContext, TContext, TInput, TOutput> {
  private middlewares: Readonly<Array<MiddlewareFunction<any, any>>>;
  private resolver: ProcedureResolver<TContext, TInput, TOutput>;
  public inputParser: ProcedureParser<TInput>;
  private parseInputFn: ParseFn<TInput>;
  public outputParser: ProcedureParser<TOutput> | undefined;
  private parseOutputFn: ParseFn<TOutput> | undefined;

  constructor(opts: ProcedureOptions<TContext, TInput, TOutput>) {
    this.middlewares = opts.middlewares;
    this.resolver = opts.resolver;
    this.inputParser = opts.inputParser;
    this.parseInputFn = getParseFn(this.inputParser);
    this.outputParser = opts.outputParser;
    this.parseOutputFn = this.outputParser && getParseFn(this.outputParser);
  }

  private async parseInput(rawInput: unknown): Promise<TInput> {
    try {
      return await this.parseInputFn(rawInput);
    } catch (cause) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause,
      });
    }
  }

  private async parseOutput(rawOutput: unknown): Promise<TOutput> {
    try {
      if (process.env.NODE_ENV === 'production' || !this.parseOutputFn) {
        return rawOutput as TOutput;
      }
      return await this.parseOutputFn(rawOutput);
    } catch (cause) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        cause,
      });
    }
  }

  /**
   * Trigger middlewares in order, parse raw input & call resolver
   * @internal
   */
  public async call(
    opts: ProcedureCallOptions<TInputContext>,
  ): Promise<TOutput> {
    // wrap the actual resolver and treat as the last "middleware"
    const middlewaresWithResolver = this.middlewares.concat([
      async ({ ctx }: { ctx: TContext }) => {
        const input = await this.parseInput(opts.rawInput);
        const output = await this.resolver({ ...opts, ctx, input });
        const data = await this.parseOutput(output);
        return {
          marker: middlewareMarker,
          ok: true,
          data,
          ctx,
        } as const;
      },
    ]);

    // create `next()` calls in resolvers
    const nextFns = middlewaresWithResolver.map((fn, index) => {
      return async (nextOpts?: { ctx: TContext }) => {
        const res = await wrapCallSafe(() =>
          fn({
            ctx: nextOpts ? nextOpts.ctx : opts.ctx,
            type: opts.type,
            path: opts.path,
            rawInput: opts.rawInput,
            next: nextFns[index + 1],
          }),
        );
        if (res.ok) {
          return res.data;
        }
        return {
          ok: false as const,
          error: getErrorFromUnknown(res.error),
        };
      };
    });

    // there's always at least one "next" since we wrap this.resolver in a middleware
    const result = await nextFns[0]();
    if (!result) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'No result from middlewares - did you forget to `return next()`?',
      });
    }
    if (!result.ok) {
      // re-throw original error
      throw result.error;
    }

    return result.data as TOutput;
  }

  /**
   * Create new procedure with passed middlewares
   * @param middlewares
   */
  public inheritMiddlewares(
    middlewares: MiddlewareFunction<TInputContext, TContext>[],
  ): this {
    const Constructor: {
      new (opts: ProcedureOptions<TContext, TInput, TOutput>): Procedure<
        TInputContext,
        TContext,
        TInput,
        TOutput
      >;
    } = (this as any).constructor;

    const instance = new Constructor({
      middlewares: [...middlewares, ...this.middlewares],
      resolver: this.resolver,
      inputParser: this.inputParser,
      outputParser: this.outputParser,
    });

    return instance as any;
  }
}

export type CreateProcedureWithInput<TContext, TInput, TOutput> = {
  input: ProcedureParser<TInput>;
  output?: ProcedureParser<TOutput>;
  resolve: ProcedureResolver<TContext, TInput, TOutput>;
};
export type CreateProcedureWithoutInput<TContext, TOutput> = {
  output?: ProcedureParser<TOutput>;
  resolve: ProcedureResolver<TContext, undefined, TOutput>;
};

export type CreateProcedureOptions<
  TContext,
  TInput = undefined,
  TOutput = undefined,
> =
  | CreateProcedureWithInput<TContext, TInput, TOutput>
  | CreateProcedureWithoutInput<TContext, TOutput>;

export function createProcedure<TContext, TInput, TOutput>(
  opts: CreateProcedureOptions<TContext, TInput, TOutput>,
): Procedure<unknown, TContext, TInput, TOutput> {
  const inputParser =
    'input' in opts
      ? opts.input
      : (input: unknown) => {
          if (input != null) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'No input expected',
            });
          }
          return undefined;
        };

  return new Procedure({
    inputParser: inputParser as any,
    resolver: opts.resolve as any,
    middlewares: [],
    outputParser: opts.output,
  });
}

export type inferProcedureFromOptions<
  TInputContext,
  TOptions extends CreateProcedureOptions<any, any, any>,
> = TOptions extends CreateProcedureOptions<
  infer TContext,
  infer TInput,
  infer TOutput
>
  ? Procedure<
      TInputContext,
      TContext,
      unknown extends TInput ? undefined : TInput,
      TOutput
    >
  : never;
