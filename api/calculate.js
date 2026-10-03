import { prepare, body } from '../lib/http.js';
import { calculate, runCalculation, CalculationError } from '../lib/calculations.js';
export default function calculation(req, res) {
  if (!prepare(req, res, 'POST')) return;
  let input;
  try { input = body(req); } catch { return res.status(400).json({ error: 'Enviá un objeto JSON válido.' }); }
  try {
    const legacy = { area: 'calculate_area', alta_dureza_reference: 'calculate_alta_dureza_reference' };
    const name = Object.hasOwn(legacy, input.type) ? legacy[input.type] : input.type === 'volume' && ['length_m', 'width_m', 'thickness_mm'].some(key => Object.hasOwn(input, key)) ? 'calculate_volume' : null;
    res.status(200).json(name ? runCalculation(name, input) : calculate(input));
  }
  catch (error) { res.status(error instanceof CalculationError ? 400 : 500).json({ error: error instanceof CalculationError ? error.message : 'No se pudo calcular.' }); }
}
