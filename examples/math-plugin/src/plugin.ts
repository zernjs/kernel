import { plugin, createAPI } from '@zern/kernel';
import type { MathAPI } from './interfaces';
import { BasicMathImpl } from './implementation/basic-math.impl';
import { AdvancedMathImpl } from './implementation/advanced-math.impl';

export const mathPlugin = plugin('math', '1.0.0').setup(() => {
  const basicMath = new BasicMathImpl();
  const advancedMath = new AdvancedMathImpl();

  return createAPI<MathAPI>([basicMath, advancedMath]);
});
