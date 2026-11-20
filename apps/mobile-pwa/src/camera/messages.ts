import { CameraError } from './CameraManager';

/** Mensagens da interface em português, por código de erro. */
const MESSAGES: Record<string, string> = {
  insecure_context:
    'A câmera só funciona em HTTPS. Abra o endereço https:// indicado pelo computador e confirme a CA local.',
  unsupported: 'Este navegador não oferece acesso à câmera. Use o Safari.',
  permission_denied:
    'Permissão de câmera negada. Em Ajustes > Safari > Câmera, permita o acesso e recarregue a página.',
  not_found: 'Nenhuma câmera encontrada neste aparelho.',
  overconstrained: 'Esta câmera não aceita a configuração pedida. O diagnóstico mostra quais aceita.',
  busy: 'A câmera está em uso por outro app. Feche-o e tente de novo.',
  unknown: 'Falha ao acessar a câmera.',
};

export function errorMessageFor(err: CameraError): string {
  return MESSAGES[err.code] ?? MESSAGES.unknown;
}
