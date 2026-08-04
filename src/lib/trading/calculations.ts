/** Volume-weighted average buy price, rounded to the nearest paise per share. */
export function calculateAveragePricePaise(
  existingQuantity: number,
  existingAveragePaise: number,
  boughtQuantity: number,
  buyPricePaise: number
): number {
  const totalQuantity = existingQuantity + boughtQuantity;
  if (totalQuantity <= 0) {
    throw new Error("Total quantity must be positive.");
  }

  return Math.round(
    (existingAveragePaise * existingQuantity + buyPricePaise * boughtQuantity) /
      totalQuantity
  );
}

/** A market sell credits the quantity sold at its fresh execution price. */
export function calculateSaleProceedsPaise(
  soldQuantity: number,
  executionPricePaise: number
): number {
  return soldQuantity * executionPricePaise;
}

export type FifoLot = {
  id: number;
  remainingQuantity: number;
  pricePaise: number;
};

export type FifoConsumption = {
  id: number;
  consumedQuantity: number;
  remainingQuantity: number;
};

/** Consume already-ordered purchase lots oldest-first and value what remains. */
export function consumeFifoLots(
  lots: FifoLot[],
  soldQuantity: number
): {
  consumptions: FifoConsumption[];
  remainingQuantity: number;
  remainingAveragePricePaise: number | null;
} {
  let quantityToConsume = soldQuantity;
  const consumptions: FifoConsumption[] = [];
  let remainingQuantity = 0;
  let remainingCostPaise = 0;

  for (const lot of lots) {
    const consumedQuantity = Math.min(
      lot.remainingQuantity,
      Math.max(0, quantityToConsume)
    );
    const lotRemainingQuantity = lot.remainingQuantity - consumedQuantity;
    quantityToConsume -= consumedQuantity;
    remainingQuantity += lotRemainingQuantity;
    remainingCostPaise += lotRemainingQuantity * lot.pricePaise;
    consumptions.push({
      id: lot.id,
      consumedQuantity,
      remainingQuantity: lotRemainingQuantity,
    });
  }

  if (quantityToConsume > 0) {
    throw new Error("FIFO lots do not contain enough shares.");
  }

  return {
    consumptions,
    remainingQuantity,
    remainingAveragePricePaise:
      remainingQuantity > 0
        ? Math.round(remainingCostPaise / remainingQuantity)
        : null,
  };
}
