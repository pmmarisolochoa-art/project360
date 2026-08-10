/**
 * "+ Nueva tarea" desde Mi Espacio.
 *
 * POR QUÉ EXISTE
 * Hasta ahora el espacio del miembro era de solo consumo: podía marcar como
 * hecho lo que le mandaban, pero no anotar lo suyo. Para crear algo tenía que
 * entrar al cerebro de un cliente — y para lo personal, directamente no podía.
 *
 * Es un formulario CORTO a propósito: título, destino y fecha. El formulario
 * completo (KPI, dependencias, subtareas, comentarios) vive en el módulo de
 * Tareas del cliente y es una herramienta de PM. Quien apunta algo entre dos
 * reuniones no necesita catorce campos, necesita que no le estorben.
 *
 * "PERSONAL" — cómo funciona por dentro
 * `tasks.client_id` es obligatorio, así que una tarea personal se guarda en el
 * Espacio de Agencia marcada como privada. El miembro no ve ese cliente, así
 * que su id se pide a la función `mi_espacio_personal()` (migración 035). Si
 * la agencia no tiene espacio marcado, la función devuelve null y la opción
 * simplemente no se ofrece — en vez de fallar al guardar.
 */

import { useEffect, useState } from 'react';
import { Plus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/store/useToastStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useClientStore } from '@/store/useClientStore';
import { supabase } from '@/services/supabase';
import { genId } from '@/utils/id';
import type { Client } from '@/types/client';
import type { TaskPriority } from '@/types/task';

/** Valor del selector que representa "no es de ningún cliente". */
const PERSONAL = 'personal';

const PRIORIDADES: Array<{ value: TaskPriority; label: string }> = [
  { value: 'P1', label: 'P1 — urgente' },
  { value: 'P2', label: 'P2 — normal' },
  { value: 'P3', label: 'P3 — puede esperar' },
];

/** Fecha de hoy en formato `yyyy-mm-dd` para el input, en hora local. */
function hoyISO(diasDespues = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + diasDespues);
  // `toISOString` pasa a UTC y en América eso puede devolver el día anterior.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function NuevaTareaMiEspacio({ misClientes }: { misClientes: Client[] }) {
  const authUserId = useAuthStore((s) => s.user?.id);
  const accesses = useAuthStore((s) => s.clientAccesses);
  const addTask = useClientStore((s) => s.addTask);

  const [abierto, setAbierto] = useState(false);
  const [espacioPersonalId, setEspacioPersonalId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [destino, setDestino] = useState(PERSONAL);
  const [fecha, setFecha] = useState(hoyISO(1));
  const [prioridad, setPrioridad] = useState<TaskPriority>('P2');
  const [guardando, setGuardando] = useState(false);

  // El id del Espacio de Agencia se pide una vez al abrir. Es una llamada
  // barata y el dato no cambia; pedirlo al montar la página sería gastar una
  // consulta en cada visita para algo que quizá no se use.
  useEffect(() => {
    if (!abierto || !supabase || espacioPersonalId !== null) return;
    void supabase
      .rpc('mi_espacio_personal')
      .then(({ data, error }) => {
        if (error) {
          // Sin espacio no se puede crear personal, pero sí por cliente: se
          // degrada en vez de romperse.
          console.warn('[mi-espacio] no se pudo resolver el espacio personal', error);
          return;
        }
        if (data) setEspacioPersonalId(data as string);
        else setDestino(misClientes[0]?.id ?? PERSONAL);
      });
  }, [abierto, espacioPersonalId, misClientes]);

  const puedePersonal = espacioPersonalId !== null;

  const opciones = [
    ...(puedePersonal ? [{ value: PERSONAL, label: '🔒 Personal — solo yo' }] : []),
    ...misClientes.map((c) => ({ value: c.id, label: c.name })),
  ];

  const cerrar = () => {
    setAbierto(false);
    setTimeout(() => {
      setTitulo('');
      setFecha(hoyISO(1));
      setPrioridad('P2');
    }, 200);
  };

  const crear = async () => {
    const esPersonal = destino === PERSONAL;
    const clientId = esPersonal ? espacioPersonalId : destino;
    if (!clientId) {
      toast.error('No se pudo determinar dónde guardar la tarea.');
      return;
    }

    // El responsable es el nombre de la persona EN ESE CLIENTE: es el campo con
    // el que la app decide de quién es cada tarea. En una personal no hay
    // cliente donde mirar, así que se usa el primero que tenga.
    const nombre =
      accesses.find((a) => a.clientId === clientId)?.nombre ?? accesses[0]?.nombre ?? '';

    setGuardando(true);
    // Se ESPERA la confirmación de la base antes de decir que se guardó. Antes
    // esto era optimista y cantaba "creada" aunque el guardado fallara: la
    // tarea aparecía en pantalla y se esfumaba al recargar. Es la misma regla
    // que ya estaba escrita para el resto de escrituras.
    const guardada = await addTask({
      id: genId(),
      clientId,
      title: titulo.trim(),
      status: 'pending',
      priority: prioridad,
      assignedTo: nombre,
      // Mediodía y no medianoche: así un desfase de zona horaria no mueve la
      // tarea al día anterior en la rejilla de Mi semana.
      dueDate: new Date(`${fecha}T12:00:00`).toISOString(),
      isDelayed: false,
      delayDays: 0,
      createdAt: new Date().toISOString(),
      esPrivada: esPersonal,
      // Sin dueño, una fila privada es invisible para todos — lo impide el
      // CHECK de la migración 030.
      propietarioId: esPersonal ? authUserId : undefined,
    });
    setGuardando(false);

    // Si falló, el store ya mostró el error y retiró la fila. El modal se queda
    // ABIERTO con lo escrito: cerrarlo obligaría a teclearlo todo otra vez.
    if (!guardada) return;

    toast.success(esPersonal ? 'Tarea personal creada' : 'Tarea creada');
    cerrar();
  };

  return (
    <>
      <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAbierto(true)}>
        Nueva tarea
      </Button>

      <Modal
        open={abierto}
        onClose={cerrar}
        title="Nueva tarea"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button onClick={crear} loading={guardando} disabled={!titulo.trim()}>
              Crear
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="¿Qué hay que hacer?"
            placeholder="Ej: preparar guion del reel"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            autoFocus
          />

          <Select
            label="¿De quién es?"
            options={opciones}
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            hint={
              destino === PERSONAL
                ? 'Solo la ves tú. No aparece para el equipo ni en los reportes.'
                : 'La verá el equipo de ese cliente.'
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Para cuándo"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <Select
              label="Prioridad"
              options={PRIORIDADES}
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as TaskPriority)}
            />
          </div>

          {destino === PERSONAL && (
            <p className="flex items-start gap-2 text-[11px] text-text-muted">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent-violet" />
              Las tareas personales son privadas siempre. Aparecen en tu semana con un candado.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
