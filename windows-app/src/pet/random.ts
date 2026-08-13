export type RandomSource = () => number;

export function randomBetween(
  minimum: number,
  maximum: number,
  random: RandomSource,
): number {
  const value = Math.min(Math.max(random(), 0), 0.999_999_999);
  return minimum + value * (maximum - minimum);
}

export function randomItem<T>(items: readonly T[], random: RandomSource): T {
  const value = Math.min(Math.max(random(), 0), 0.999_999_999);
  return items[Math.floor(value * items.length)]!;
}
