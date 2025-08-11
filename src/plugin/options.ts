/**
 * @file Plugin options validation helpers.
 */
export interface OptionsValidator<Schema, Output> {
  readonly schema: Schema;
  parse(input: unknown): Output;
}

export interface PluginOptionsSpec<Schema = unknown, Output = unknown> {
  validator: OptionsValidator<Schema, Output>;
  defaultValue?: Output;
}

function isNil(v: unknown): v is null | undefined {
  return v === null || v === undefined;
}

/**
 * Validates and resolves plugin options using the provided spec.
 * @param spec Options spec with validator and optional default.
 * @param input Raw input.
 * @returns Parsed options or the default value when input is nil.
 * @throws Error when validation fails.
 */
export function validateOptions<Schema, Output>(
  spec: PluginOptionsSpec<Schema, Output> | undefined,
  input: unknown
): Output | undefined {
  if (!spec) return undefined;
  if (isNil(input)) return spec.defaultValue;
  try {
    return spec.validator.parse(input);
  } catch (e) {
    const err = e as Error;
    throw new Error(`Plugin options validation failed: ${err.message}`);
  }
}
