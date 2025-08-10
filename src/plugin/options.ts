export interface OptionsValidator<Schema, Output> {
  readonly schema: Schema;
  parse(input: unknown): Output;
}

export interface PluginOptionsSpec<Schema = unknown, Output = unknown> {
  validator: OptionsValidator<Schema, Output>;
  defaultValue?: Output;
}

export function validateOptions<Schema, Output>(
  spec: PluginOptionsSpec<Schema, Output> | undefined,
  input: unknown
): Output | undefined {
  if (!spec) return undefined;
  if (input === undefined || input === null) return spec.defaultValue;
  try {
    return spec.validator.parse(input);
  } catch (e) {
    // surface a consistent error shape to callers; they may wrap into KernelError upstream
    const err = e as Error;
    throw new Error(`Plugin options validation failed: ${err.message}`);
  }
}
