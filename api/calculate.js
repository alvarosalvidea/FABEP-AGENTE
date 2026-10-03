import {runCalculation} from '../lib/calculations.js';
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});
  const map={area:'calculate_area',volume:'calculate_volume',alta_dureza_reference:'calculate_alta_dureza_reference'};
  const name=map[req.body?.type];
  if(!name) return res.status(400).json({error:'Tipo de cálculo no autorizado'});
  try{return res.status(200).json(runCalculation(name,req.body||{}));}
  catch{return res.status(400).json({error:'Parámetros de cálculo inválidos'});}
}
