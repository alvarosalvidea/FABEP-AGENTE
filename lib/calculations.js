import { runCalculation as legacyRun, CALCULATION_TOOLS } from './legacy-calculations.js';
export { CALCULATION_TOOLS };
export class CalculationError extends Error {}
export function runCalculation(name, args = {}) {
  for (const value of Object.values(args)) {
    if (typeof value === 'boolean' || (typeof value === 'number' && !Number.isFinite(value))) throw new CalculationError('Parámetros de cálculo inválidos.');
  }
  try {
    const output = legacyRun(name, args);
    if (Object.values(output).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new Error();
    return output;
  } catch { throw new CalculationError('Parámetros de cálculo inválidos.'); }
}
const ratios = Object.freeze({ plus_art: [1, 1], alta_dureza: [1, 0.6], mesas_de_rio: [1, 0.6], multiproposito_2_1: [2, 1] });
function positive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1e9) throw new CalculationError(`${label} debe ser un número positivo finito menor o igual a 1.000.000.000.`);
  return value;
}
function result(value) {
  if (!Number.isFinite(value) || value > 1e12) throw new CalculationError('El resultado excede el rango permitido.');
  return Math.round(value * 1e6) / 1e6;
}
export function calculate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new CalculationError('Cálculo inválido.');
  if (input.type === 'mixture') {
    if (!Object.hasOwn(ratios, input.product)) throw new CalculationError('Producto no validado. VALIDAR CON ÁLVARO O SUSANA.');
    const ratio = ratios[input.product];
    const total = positive(input.totalGrams, 'totalGrams');
    return { kind: 'dosificación por peso', product: input.product, ratio: `${ratio[0]}:${ratio[1]}`, totalGrams: total, aGrams: result(total * ratio[0] / (ratio[0] + ratio[1])), bGrams: result(total * ratio[1] / (ratio[0] + ratio[1])), note: 'La masa indicada es el total A+B. Pesar ambos componentes; nunca ajustar la relación por temperatura.' };
  }
  if (input.type === 'volume') {
    const litres = positive(input.lengthCm, 'lengthCm') * positive(input.widthCm, 'widthCm') * positive(input.thicknessCm, 'thicknessCm') / 1000;
    return { kind: 'cálculo geométrico', litres: result(litres), note: 'Volumen rectangular teórico, sin pérdidas. No convertir a kg sin densidad Fabep validada. No es una recomendación de producto o espesor.' };
  }
  if (input.type === 'consumption') {
    if (input.product !== 'alta_dureza') throw new CalculationError('Referencia de consumo no validada. VALIDAR CON ÁLVARO O SUSANA.');
    const kilograms = positive(input.areaM2, 'areaM2') * positive(input.thicknessMm, 'thicknessMm');
    return { kind: 'referencia de consumo', kilograms: result(kilograms), reference: 'Fabep Alta Dureza: 1 kg/m² a 1 mm.', note: 'Estimación proporcional sin pérdidas; no aprueba espesores ni reemplaza una recomendación comercial.' };
  }
  throw new CalculationError('type debe ser mixture, volume o consumption.');
}
export const CALCULATE_TOOL = {
  type: 'function', name: 'calculate_quantity',
  description: 'Cálculo determinístico Fabep. mixture: product y totalGrams (masa total A+B). volume: lengthCm, widthCm, thicknessCm. consumption: product alta_dureza, areaM2 y thicknessMm. Los campos no aplicables deben ser null.',
  strict: true,
  parameters: { type: 'object', additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['mixture', 'volume', 'consumption'] },
      product: { type: ['string', 'null'], enum: ['plus_art', 'alta_dureza', 'mesas_de_rio', 'multiproposito_2_1', null] },
      totalGrams: { type: ['number', 'null'] }, lengthCm: { type: ['number', 'null'] }, widthCm: { type: ['number', 'null'] }, thicknessCm: { type: ['number', 'null'] }, areaM2: { type: ['number', 'null'] }, thicknessMm: { type: ['number', 'null'] }
    }, required: ['type', 'product', 'totalGrams', 'lengthCm', 'widthCm', 'thicknessCm', 'areaM2', 'thicknessMm'] }
};
