import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export function PlaceholderModule({
  title,
  description,
  features,
  accent,
}: {
  title: string;
  description: string;
  features: string[];
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface p-8"
    >
      <div className="flex items-start gap-4 mb-6">
        <div
          className="h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
            boxShadow: `0 0 20px -4px ${accent}88`,
          }}
        >
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="heading text-xl font-bold">{title}</h2>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {features.map((f) => (
          <div
            key={f}
            className="rounded-[10px] border border-border-subtle bg-bg-base/30 p-3 text-sm text-text-secondary"
          >
            <span className="mr-2 text-text-muted">›</span>
            {f}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[10px] border border-dashed border-border-default p-4 text-center text-xs text-text-muted">
        Módulo en construcción — UI esqueleto listo, lógica e integraciones se activan en próximas sesiones.
      </div>
    </motion.div>
  );
}
