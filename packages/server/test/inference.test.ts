/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expectTypeOf } from 'expect-type';
import { z } from 'zod';
import * as trpc from '../src';
import { inferProcedureInput, inferProcedureOutput } from '../src';

test('infer query input & output', async () => {
  const router = trpc
    .router()
    .query('withInput', {
      input: z.string(),
      async resolve({ input }) {
        return { input };
      },
    })
    .query('noInput', {
      async resolve({ input }) {
        return { input };
      },
    })
    .query('withOutput', {
      input: z.string(),
      output: z.object({
        input: z.string(),
      }),
      async resolve({ input }) {
        return { input };
      },
    })
    .query('preferOutput', {
      input: z.string(),
      output: z.object({
        input: z.string(),
      }),
      // @ts-ignore - ensuring types from "output" are expected
      async resolve({ input }) {
        return { input2: input };
      },
    });
  type TQueries = typeof router['_def']['queries'];
  {
    const input: inferProcedureInput<TQueries['withInput']> = null as any;
    const output: inferProcedureOutput<TQueries['withInput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<string>();
    expectTypeOf(output).toMatchTypeOf<{ input: string }>();
  }
  {
    const input: inferProcedureInput<TQueries['noInput']> = null as any;
    const output: inferProcedureOutput<TQueries['noInput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<undefined | null | void>();
    expectTypeOf(output).toMatchTypeOf<{ input: undefined }>();
  }
  {
    const input: inferProcedureInput<TQueries['withOutput']> = null as any;
    const output: inferProcedureOutput<TQueries['withOutput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<string>();
    expectTypeOf(output).toMatchTypeOf<{ input: string }>();
  }
  {
    const input: inferProcedureInput<TQueries['preferOutput']> = null as any;
    const output: inferProcedureOutput<TQueries['preferOutput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<string>();
    expectTypeOf(output).toMatchTypeOf<{ input: string }>();
  }
});

test('infer mutation input & output', async () => {
  const router = trpc
    .router()
    .mutation('withInput', {
      input: z.string(),
      async resolve({ input }) {
        return { input };
      },
    })
    .mutation('noInput', {
      async resolve({ input }) {
        return { input };
      },
    })
    .mutation('withOutput', {
      input: z.string(),
      output: z.object({
        input: z.string(),
      }),
      async resolve({ input }) {
        return { input };
      },
    })
    .mutation('preferOutput', {
      input: z.string(),
      output: z.object({
        input: z.string(),
      }),
      // @ts-ignore - ensuring types from "output" are expected
      async resolve({ input }) {
        return { input2: input };
      },
    });
  type TMutations = typeof router['_def']['mutations'];
  {
    const input: inferProcedureInput<TMutations['withInput']> = null as any;
    const output: inferProcedureOutput<TMutations['withInput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<string>();
    expectTypeOf(output).toMatchTypeOf<{ input: string }>();
  }
  {
    const input: inferProcedureInput<TMutations['noInput']> = null as any;
    const output: inferProcedureOutput<TMutations['noInput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<undefined | null | void>();
    expectTypeOf(output).toMatchTypeOf<{ input: undefined }>();
  }
  {
    const input: inferProcedureInput<TMutations['withOutput']> = null as any;
    const output: inferProcedureOutput<TMutations['withOutput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<string>();
    expectTypeOf(output).toMatchTypeOf<{ input: string }>();
  }
  {
    const input: inferProcedureInput<TMutations['preferOutput']> = null as any;
    const output: inferProcedureOutput<TMutations['preferOutput']> =
      null as any;
    expectTypeOf(input).toMatchTypeOf<string>();
    expectTypeOf(output).toMatchTypeOf<{ input: string }>();
  }
});

test('infer subscription input & output', async () => {
  const router = trpc
    .router()
    .subscription('withInput', {
      input: z.string(),
      async resolve({ input }) {
        return new trpc.Subscription<typeof input>((emit) => {
          emit.data(input);
          return () => null;
        });
      },
    })
    .subscription('noInput', {
      async resolve({ input }) {
        return new trpc.Subscription<typeof input>((emit) => {
          emit.data(input);
          return () => null;
        });
      },
    });
  type TSubscriptions = typeof router['_def']['subscriptions'];
  {
    const input: inferProcedureInput<TSubscriptions['withInput']> = null as any;
    const output: inferProcedureOutput<TSubscriptions['withInput']> =
      null as any;
    expectTypeOf(input).toMatchTypeOf<string>();
    expectTypeOf(output).toMatchTypeOf<trpc.Subscription<string>>();
  }
  {
    const input: inferProcedureInput<TSubscriptions['noInput']> = null as any;
    const output: inferProcedureOutput<TSubscriptions['noInput']> = null as any;
    expectTypeOf(input).toMatchTypeOf<undefined | null | void>();
    expectTypeOf(output).toMatchTypeOf<trpc.Subscription<undefined>>();
  }
});
