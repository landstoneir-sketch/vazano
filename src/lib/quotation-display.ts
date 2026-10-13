export function displayedQuotationAmountRial(finalAmountRial: string, taxRial: string, taxInclusive: boolean): bigint {
  const finalAmount = BigInt(finalAmountRial);
  return taxInclusive ? finalAmount : finalAmount - BigInt(taxRial);
}
