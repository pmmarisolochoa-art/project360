import { TasksModule } from '@/components/brain/modules/TasksModule';
import { ParaleloImportButton } from '@/components/brain/modules/ParaleloImportButton';

/**
 * Tareas (vista global, Capa 0) — /tareas
 *
 * Monta EL MISMO módulo de tareas del cerebro del cliente en modo global
 * (`client={null}`): mismos tabs rápidos (Todas / Mis tareas / Vencidas / Hoy /
 * Esta semana), mismos filtros, Kanban + Lista + Gantt, drag & drop, KPI de
 * resultado, recordatorios y detector de duplicados — más un filtro de cliente
 * y un badge de cliente en cada tarjeta.
 *
 * Antes esta página era una tabla aparte con 3 filtros, y se quedaba atrás cada
 * vez que el módulo del cliente mejoraba. Un solo componente evita esa deriva.
 */
export function AllTasksPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-text-muted">Vista global</div>
          <h1 className="heading text-3xl font-bold gradient-text">Tareas</h1>
          <p className="text-sm text-text-secondary mt-1">
            Todas las tareas de todos los clientes, con los mismos filtros del cerebro del cliente
          </p>
        </div>
        {/* Traer de Paralelo desde aquí: es la pantalla donde se trabaja el día
            a día, y obligar a entrar al cerebro del cliente solo para importar
            es un rodeo. Mismo botón y misma bandeja que en la Agenda. */}
        <ParaleloImportButton />
      </header>

      <TasksModule client={null} />
    </div>
  );
}
