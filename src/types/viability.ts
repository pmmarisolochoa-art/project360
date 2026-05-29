export interface SopAnswer {
  questionId: number;
  value: number; // 0..4
}

export interface SopAssessment {
  id: string;
  prospectName: string;
  createdAt: string;
  answers: SopAnswer[];
  score: number;
  blockScores: Record<'A' | 'B' | 'C' | 'D' | 'E', number>;
  verdict: 'ideal' | 'viable' | 'risky' | 'reject';
  decision?: string;
}

export interface SopQuestion {
  id: number;
  block: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
  options: Array<{ label: string; value: number }>;
}

export const SOP_BLOCKS: Record<'A' | 'B' | 'C' | 'D' | 'E', string> = {
  A: 'Potencial del negocio',
  B: 'Capacidad de inversión',
  C: 'Actitud y colaboración',
  D: 'Mercado y competencia',
  E: 'Producto y oferta',
};

export const SOP_QUESTIONS: SopQuestion[] = [
  // BLOQUE A
  { id: 1,  block: 'A', text: '¿Cuánto tiempo lleva el negocio operando?', options: [{ label: 'Menos de 6 meses', value: 0 }, { label: '6-12 meses', value: 1 }, { label: '1-3 años', value: 3 }, { label: '+3 años', value: 4 }] },
  { id: 2,  block: 'A', text: '¿Tiene producto/servicio validado con ventas reales?', options: [{ label: 'No', value: 0 }, { label: 'Sí, pocas ventas', value: 2 }, { label: 'Sí, ventas consistentes', value: 4 }] },
  { id: 3,  block: 'A', text: '¿Cuál es el ticket promedio?', options: [{ label: 'Menos de $50', value: 0 }, { label: '$50-$200', value: 2 }, { label: '$200-$500', value: 3 }, { label: '+$500', value: 4 }] },
  { id: 4,  block: 'A', text: '¿Tiene testimonios o casos de éxito documentados?', options: [{ label: 'No', value: 0 }, { label: '1-2', value: 1 }, { label: '3-5', value: 2 }, { label: '+5 con resultados', value: 4 }] },
  { id: 5,  block: 'A', text: '¿Cuál es el margen de ganancia del producto/servicio?', options: [{ label: '<20%', value: 0 }, { label: '20-40%', value: 1 }, { label: '40-60%', value: 3 }, { label: '+60%', value: 4 }] },
  // BLOQUE B
  { id: 6,  block: 'B', text: '¿Cuánto puede invertir mensualmente en ADS?', options: [{ label: 'Menos de $300', value: 0 }, { label: '$300-$800', value: 2 }, { label: '$800-$2.000', value: 3 }, { label: '+$2.000', value: 4 }] },
  { id: 7,  block: 'B', text: '¿Tiene presupuesto para producción de contenido?', options: [{ label: 'No', value: 0 }, { label: 'Limitado (<$200)', value: 1 }, { label: 'Moderado ($200-$500)', value: 3 }, { label: 'Adecuado (+$500)', value: 4 }] },
  { id: 8,  block: 'B', text: '¿Puede mantener la inversión por mínimo 3 meses sin presión?', options: [{ label: 'No', value: 0 }, { label: 'Inseguro', value: 1 }, { label: 'Probablemente', value: 3 }, { label: 'Sí, confirmado', value: 4 }] },
  { id: 9,  block: 'B', text: '¿Tiene capital de trabajo suficiente para escalar si hay resultados?', options: [{ label: 'No', value: 0 }, { label: 'Limitado', value: 1 }, { label: 'Sí', value: 3 }, { label: 'Sí, con crédito disponible', value: 4 }] },
  { id: 10, block: 'B', text: '¿Está dispuesto a invertir en herramientas digitales necesarias?', options: [{ label: 'No', value: 0 }, { label: 'Con resistencia', value: 1 }, { label: 'Sí', value: 2 }, { label: 'Ya tiene el stack', value: 4 }] },
  // BLOQUE C
  { id: 11, block: 'C', text: '¿Entiende que el marketing digital tarda en dar resultados?', options: [{ label: 'No, quiere resultados inmediatos', value: 0 }, { label: 'Poco claro', value: 1 }, { label: 'Sí, entiende', value: 4 }] },
  { id: 12, block: 'C', text: '¿Tiene tiempo para revisar y aprobar materiales en menos de 48h?', options: [{ label: 'No puede comprometerse', value: 0 }, { label: 'A veces', value: 2 }, { label: 'Sí', value: 4 }] },
  { id: 13, block: 'C', text: '¿Está dispuesto a grabar contenido de video?', options: [{ label: 'No', value: 0 }, { label: 'Con resistencia', value: 1 }, { label: 'Sí con apoyo', value: 3 }, { label: 'Proactivo', value: 4 }] },
  { id: 14, block: 'C', text: '¿Acepta feedback y sugerencias estratégicas?', options: [{ label: 'Muy rígido', value: 0 }, { label: 'Poco flexible', value: 1 }, { label: 'Flexible', value: 3 }, { label: 'Muy abierto', value: 4 }] },
  { id: 15, block: 'C', text: '¿Tiene expectativas realistas sobre los resultados?', options: [{ label: 'Muy irreales', value: 0 }, { label: 'Algo irreales', value: 1 }, { label: 'Realistas', value: 4 }] },
  // BLOQUE D
  { id: 16, block: 'D', text: '¿Tiene un diferenciador claro frente a la competencia?', options: [{ label: 'No identifica', value: 0 }, { label: 'Vago', value: 1 }, { label: 'Claro pero débil', value: 2 }, { label: 'Diferenciador fuerte', value: 4 }] },
  { id: 17, block: 'D', text: '¿El mercado objetivo es suficientemente grande?', options: [{ label: 'Muy pequeño', value: 0 }, { label: 'Moderado', value: 2 }, { label: 'Mercado amplio', value: 4 }] },
  { id: 18, block: 'D', text: '¿Hay demanda real y verificable del producto/servicio?', options: [{ label: 'Sin evidencia', value: 0 }, { label: 'Incipiente', value: 2 }, { label: 'Comprobada', value: 4 }] },
  { id: 19, block: 'D', text: '¿El sector tiene buen historial de resultados con ADS?', options: [{ label: 'Difícil/regulado', value: 0 }, { label: 'Moderado', value: 2 }, { label: 'Buen ROAS', value: 4 }] },
  { id: 20, block: 'D', text: '¿La competencia tiene presencia digital activa?', options: [{ label: 'No (sin validar)', value: 0 }, { label: 'Poca', value: 2 }, { label: 'Activa (validado)', value: 4 }] },
  // BLOQUE E
  { id: 21, block: 'E', text: '¿El producto resuelve un dolor real y urgente?', options: [{ label: 'No claro', value: 0 }, { label: 'Deseo no urgente', value: 2 }, { label: 'Dolor urgente', value: 4 }] },
  { id: 22, block: 'E', text: '¿Tiene oferta clara con precio, entregables y garantía?', options: [{ label: 'No definida', value: 0 }, { label: 'Vaga', value: 1 }, { label: 'Básica', value: 2 }, { label: 'Irresistible', value: 4 }] },
  { id: 23, block: 'E', text: '¿El proceso de venta está documentado o mapeado?', options: [{ label: 'No existe', value: 0 }, { label: 'Mental', value: 1 }, { label: 'Básico', value: 2 }, { label: 'Claro y probado', value: 4 }] },
  { id: 24, block: 'E', text: '¿Tiene capacidad operativa para cumplir si escalan las ventas?', options: [{ label: 'No', value: 0 }, { label: 'Limitada', value: 1 }, { label: 'Puede escalar', value: 3 }, { label: 'Totalmente escalable', value: 4 }] },
  { id: 25, block: 'E', text: '¿Ha trabajado antes con una agencia de marketing digital?', options: [{ label: 'No, expectativas irreales', value: 0 }, { label: 'Sí con malas experiencias', value: 1 }, { label: 'No pero abierto', value: 2 }, { label: 'Sí con buenas experiencias', value: 3 }] },
];
