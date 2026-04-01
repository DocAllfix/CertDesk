// Workflow logic: fase-transitions, notifications, orchestrator
export {
  canAdvanceFase,
  isBloccataFase4,
  getNextFase,
  getPrevFase,
  FASI_ORDINE,
  FASE_INDEX,
  FASE_LABELS,
  type PreValidazioneFase,
} from './fase-transitions'

export {
  createFaseChangeNotifications,
  notifyDocumentiRicevuti,
} from './notifications'

export {
  executeAvanzaFase,
  type ExecuteAvanzaFaseParams,
} from './execute-avanza-fase'
