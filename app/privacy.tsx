/**
 * PrivacyScreen — Política de Privacidad de UMPI.
 * Copy is the client's literal legal text — do NOT translate or edit.
 * Content lives in lib/legalContent.ts (same text as the web app).
 */
import LegalDocumentScreen from '@/components/LegalDocumentScreen';
import {
  LEGAL_DOCUMENTS_CONFIG,
  LEGAL_VERSION_LABEL,
  PRIVACY_SECTIONS,
} from '@/lib/legalContent';

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      headerTitle={LEGAL_DOCUMENTS_CONFIG.privacy.fullTitle}
      title={`${LEGAL_DOCUMENTS_CONFIG.privacy.fullTitle} de UMPI.`}
      updatedAt={`Última actualización: ${LEGAL_VERSION_LABEL}`}
      sections={PRIVACY_SECTIONS}
    />
  );
}
