/**
 * Shared legal version + copy for the mobile legal consent system.
 *
 * Mirrors src/features/legal/legalContent.ts and the legal pages of the web
 * app (umpi-web): same LEGAL_VERSION contract with the server-side registry
 * (legal_consent_versions) and the same literal legal text. The copy is the
 * client's legal text — do NOT translate or edit it.
 *
 * WHY VERSIONED: the current legal copy ships with the app under
 * LEGAL_VERSION. When the copy changes (Términos / Política de Privacidad),
 * bump LEGAL_VERSION — every user who accepted only an older version is
 * re-gated by LegalConsentGate until they accept the new text. Old rows in
 * `legal_consents` stay untouched as the audit trail.
 */

/**
 * Current version of the legal texts (Términos / Política de Privacidad).
 * Bump here → also add a row to legal_consent_versions in a migration →
 * users re-gate. Must match the web app's LEGAL_VERSION.
 */
export const LEGAL_VERSION = '2026-08-14';

/**
 * Single source of truth for the legal documents. The keys are the document
 * IDs stored in `legal_consents.document`; each entry carries the route and
 * the display titles used across the app (gate links, settings rows, legal
 * pages). All consumers derive from this map — no hardcoded routes/titles.
 */
export const LEGAL_DOCUMENTS_CONFIG = {
  terms: {
    route: '/terms',
    shortTitle: 'Términos',
    fullTitle: 'Términos y Condiciones',
  },
  privacy: {
    route: '/privacy',
    shortTitle: 'Privacidad',
    fullTitle: 'Política de Privacidad',
  },
} as const;

export type LegalDocument = keyof typeof LEGAL_DOCUMENTS_CONFIG;

/** Document IDs the user must accept, in display order. */
export const LEGAL_DOCUMENTS = Object.keys(
  LEGAL_DOCUMENTS_CONFIG,
) as LegalDocument[];

/**
 * '1 de agosto de 2026' — Spanish label for LEGAL_VERSION.
 * Parsed from the ISO parts explicitly so it is deterministic;
 * toLocaleDateString would vary with the runtime locale.
 */
export const LEGAL_VERSION_LABEL = (() => {
  const [year, month, day] = LEGAL_VERSION.split('-').map(Number);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${day} de ${months[month - 1]} de ${year}`;
})();

/**
 * Plain-language summary shown on the consent gate.
 * Paraphrase of the client's legal copy — if the client updates the
 * privacy policy, update here too; keep in sync with the web app.
 */
export const LEGAL_GATE_SUMMARY =
  'En UMPI usamos tus datos para gestionar tu cuenta, mostrar tus publicaciones y facilitar el contacto entre compradores y vendedores. No vendemos tus datos personales y aplicamos medidas de seguridad para protegerlos.';

/**
 * One section of a legal document. `blocks` preserves the source order of
 * the web pages: a string is a paragraph, a string[] is a bullet list.
 */
export interface LegalSection {
  title: string;
  blocks: (string | string[])[];
}

// ── Términos y Condiciones de uso de UMPI ────────────────────────────────
// Copy is the client's literal legal text — do NOT translate or edit.
// Source: umpi-web/src/features/legal/pages/TermsPage.tsx

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Identificación',
    blocks: [
      'Bienvenido a UMPI. Al utilizar la aplicación o el sitio web de UMPI, aceptás estos Términos y Condiciones. Si no estás de acuerdo con ellos, no deberás utilizar la plataforma.',
    ],
  },
  {
    title: 'Objeto de UMPI',
    blocks: [
      'UMPI es una plataforma digital destinada a la publicación de anuncios clasificados de bienes y servicios.',
      'UMPI facilita el contacto entre usuarios, pero no compra, vende, distribuye ni garantiza los productos o servicios publicados.',
    ],
  },
  {
    title: 'Registro',
    blocks: [
      'Para utilizar determinadas funciones será necesario crear una cuenta.',
      'El usuario declara que los datos suministrados son verdaderos y se compromete a mantenerlos actualizados.',
    ],
  },
  {
    title: 'Publicaciones',
    blocks: [
      'Cada usuario es el único responsable de:',
      [
        'La información publicada.',
        'Las fotografías.',
        'Los precios.',
        'La descripción.',
        'La legalidad del producto o servicio ofrecido.',
      ],
      'Está prohibido publicar:',
      [
        'Productos ilegales.',
        'Armas.',
        'Drogas.',
        'Contenido ofensivo.',
        'Material con derechos de autor sin autorización.',
        'Información falsa o engañosa.',
      ],
      'UMPI podrá eliminar publicaciones que incumplan estas normas.',
    ],
  },
  {
    title: 'Responsabilidad',
    blocks: [
      'UMPI no garantiza:',
      [
        'La identidad de los usuarios.',
        'La calidad de los productos.',
        'El cumplimiento de las operaciones.',
        'La veracidad de las publicaciones.',
      ],
      'Toda negociación será responsabilidad exclusiva de las partes.',
    ],
  },
  {
    title: 'Pagos',
    blocks: [
      'Las publicaciones destacadas y suscripciones podrán abonarse mediante Mercado Pago.',
      'Los pagos son procesados exclusivamente por Mercado Pago conforme a sus propios términos y políticas.',
      'UMPI no almacena datos de tarjetas de crédito o débito.',
    ],
  },
  {
    title: 'Suscripciones',
    blocks: [
      'Las suscripciones podrán renovarse automáticamente mientras el usuario no solicite su cancelación.',
      'El usuario podrá cancelar la renovación desde su cuenta o mediante los canales de atención indicados.',
    ],
  },
  {
    title: 'Derecho de arrepentimiento',
    blocks: [
      'Cuando corresponda conforme a la legislación argentina, el usuario podrá ejercer el derecho de revocar la contratación dentro del plazo legal.',
    ],
  },
  {
    title: 'Suspensión de cuentas',
    blocks: [
      'UMPI podrá suspender o eliminar cuentas que:',
      [
        'Incumplan estos términos.',
        'Publiquen contenido prohibido.',
        'Realicen actividades fraudulentas.',
        'Intenten vulnerar la seguridad de la plataforma.',
      ],
    ],
  },
  {
    title: 'Propiedad intelectual',
    blocks: [
      'Todo el contenido propio de UMPI (marca, logotipo, diseño, software y textos) pertenece a UMPI.',
      'No podrá copiarse sin autorización.',
    ],
  },
  {
    title: 'Modificaciones',
    blocks: [
      'UMPI podrá modificar estos términos cuando resulte necesario.',
      'Las modificaciones serán publicadas dentro de la plataforma indicando su fecha de actualización.',
    ],
  },
  {
    title: 'Legislación aplicable',
    blocks: ['Estos términos se regirán por las leyes de la República Argentina.'],
  },
];

// ── Política de Privacidad de UMPI ───────────────────────────────────────
// Copy is the client's literal legal text — do NOT translate or edit.
// Source: umpi-web/src/features/legal/pages/PrivacyPage.tsx

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Información recopilada',
    blocks: [
      'UMPI puede recopilar:',
      [
        'Nombre.',
        'Correo electrónico.',
        'Número de teléfono.',
        'Ciudad.',
        'Ciudad seleccionada manualmente por el usuario (la app no accede a la ubicación del dispositivo).',
        'Fotografías de publicaciones.',
        'Descripción de los avisos.',
        'Dirección IP.',
        'Datos técnicos del dispositivo.',
        'Información de uso de la plataforma.',
      ],
    ],
  },
  {
    title: 'Finalidad',
    blocks: [
      'Los datos serán utilizados para:',
      [
        'Crear la cuenta.',
        'Publicar anuncios.',
        'Mostrar publicaciones.',
        'Contactar usuarios.',
        'Brindar soporte.',
        'Mejorar la plataforma.',
        'Detectar fraudes.',
        'Cumplir obligaciones legales.',
      ],
    ],
  },
  {
    title: 'Pagos',
    blocks: [
      'Los pagos de publicaciones destacadas y suscripciones son procesados por Mercado Pago.',
      'UMPI no almacena números completos de tarjetas ni credenciales bancarias.',
    ],
  },
  {
    title: 'Compartición de datos',
    blocks: [
      'Los datos podrán compartirse únicamente con:',
      [
        'Mercado Pago (para pagos).',
        'Proveedores tecnológicos.',
        'Autoridades competentes cuando la ley lo requiera.',
      ],
      'UMPI no vende datos personales.',
    ],
  },
  {
    title: 'Seguridad',
    blocks: [
      'UMPI adopta medidas técnicas y organizativas para proteger la información contra accesos no autorizados.',
    ],
  },
  {
    title: 'Derechos del usuario',
    blocks: [
      'De conformidad con la Ley 25.326, el usuario podrá solicitar:',
      ['Acceso.', 'Rectificación.', 'Actualización.', 'Supresión de sus datos personales.'],
      'Las solicitudes podrán realizarse mediante el correo electrónico oficial de soporte de UMPI.',
    ],
  },
  {
    title: 'Eliminación de Cuenta y Datos Personales',
    blocks: [
      'En UMPI, los usuarios tienen derecho a solicitar la eliminación total de su cuenta y de todos sus datos asociados en cualquier momento.',
      'Cómo solicitar la eliminación de tu cuenta:',
      [
        'Desde la Aplicación: Ve a Perfil > Ajustes > Eliminar cuenta.',
        'Por Correo Electrónico: Envía una solicitud de eliminación a nuestro equipo de soporte a soporte@umpi.com.ar desde la dirección de correo registrada en tu cuenta de UMPI.',
      ],
      'Datos que se eliminan:',
      'Al procesar la solicitud, eliminaremos de forma permanente:',
      [
        'Tu perfil de usuario (nombre, correo electrónico y datos de contacto).',
        'Todas tus publicaciones y avisos clasificados subidos.',
        'Tu historial de chats e imágenes asociadas.',
      ],
      'Retención de datos:',
      'Los datos se eliminan de manera inmediata al confirmar la solicitud. Algunos registros técnicos de seguridad se conservarán por un período máximo de 30 días únicamente para fines de auditoría y prevención de fraudes, tras lo cual serán eliminados por completo.',
    ],
  },
  {
    title: 'Conservación',
    blocks: [
      'Los datos serán conservados mientras exista la cuenta o durante el tiempo necesario para cumplir obligaciones legales.',
    ],
  },
  {
    title: 'Cookies',
    blocks: [
      'El sitio web podrá utilizar cookies para mejorar la experiencia del usuario y obtener estadísticas de uso.',
    ],
  },
  {
    title: 'Menores de edad',
    blocks: [
      'UMPI no está destinada a menores de 18 años sin autorización de sus representantes legales.',
    ],
  },
  {
    title: 'Actualizaciones',
    blocks: [
      'Esta Política de Privacidad podrá modificarse cuando resulte necesario.',
      'La fecha de la última actualización será publicada junto con este documento.',
    ],
  },
];
