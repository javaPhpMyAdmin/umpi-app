/**
 * TermsScreen — Términos y Condiciones de uso de UMPI.
 * Copy is the client's literal legal text — do NOT translate or edit.
 * Content lives in lib/legalContent.ts (same text as the web app).
 */
import LegalDocumentScreen from '@/components/LegalDocumentScreen';
import {
  LEGAL_DOCUMENTS_CONFIG,
  LEGAL_VERSION_LABEL,
  TERMS_SECTIONS,
} from '@/lib/legalContent';

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      headerTitle={LEGAL_DOCUMENTS_CONFIG.terms.fullTitle}
      title={`${LEGAL_DOCUMENTS_CONFIG.terms.fullTitle} de uso de UMPI.`}
      updatedAt={`Última actualización: ${LEGAL_VERSION_LABEL}`}
      sections={TERMS_SECTIONS}
    />
  );
}
