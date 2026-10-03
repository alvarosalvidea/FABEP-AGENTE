function positive(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
export function runCalculation(name,args={}){
  if(name==='calculate_area'){const length=positive(args.length_m),width=positive(args.width_m);if(!length||!width)throw new Error('Medidas inválidas');return{area_m2:Number((length*width).toFixed(4)),kind:'geometric'}}
  if(name==='calculate_volume'){const length=positive(args.length_m),width=positive(args.width_m),thickness=positive(args.thickness_mm);if(!length||!width||!thickness)throw new Error('Medidas inválidas');const liters=length*width*thickness;return{volume_l:Number(liters.toFixed(3)),kind:'geometric',note:'Volumen geométrico. No equivale automáticamente a kg.'}}
  if(name==='calculate_alta_dureza_reference'){const area=positive(args.area_m2),thickness=positive(args.thickness_mm);if(!area||!thickness)throw new Error('Área o espesor inválido');return{reference_kg:Number((area*thickness).toFixed(2)),basis:'Referencia Fabep validada: 1 kg/m² a 1 mm.',warning:'Cálculo de referencia; condiciones reales del soporte/proyecto pueden requerir validación técnica.'}}
  throw new Error('Cálculo no autorizado')
}
export const CALCULATION_TOOLS=[
 {type:'function',name:'calculate_area',description:'Calcula el área rectangular en m² a partir de largo y ancho en metros. Usar para evitar cálculo mental.',parameters:{type:'object',properties:{length_m:{type:'number',description:'Largo en metros'},width_m:{type:'number',description:'Ancho en metros'}},required:['length_m','width_m'],additionalProperties:false},strict:true},
 {type:'function',name:'calculate_volume',description:'Calcula volumen geométrico en litros a partir de largo, ancho y espesor. NO convierte litros a kg.',parameters:{type:'object',properties:{length_m:{type:'number'},width_m:{type:'number'},thickness_mm:{type:'number'}},required:['length_m','width_m','thickness_mm'],additionalProperties:false},strict:true},
 {type:'function',name:'calculate_alta_dureza_reference',description:'Calcula kg de referencia para Fabep Alta Dureza usando exclusivamente la referencia validada de 1 kg/m² a 1 mm.',parameters:{type:'object',properties:{area_m2:{type:'number'},thickness_mm:{type:'number'}},required:['area_m2','thickness_mm'],additionalProperties:false},strict:true}
];
