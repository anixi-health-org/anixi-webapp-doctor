import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileText, Save, Sparkles } from 'lucide-react';
import { COMMON_ICD10_CODES } from '../../lib/southAfrica';
import {
  CLINICAL_REPORT_SECTIONS,
  clinicalReportHasContent,
  type ClinicalReportSections,
} from '../../lib/clinicalReportFormat';
import {
  createClinicalReportPdfBlobUrl,
  downloadClinicalReportDocx,
  downloadClinicalReportPdf,
  type ClinicalReportExportParams,
} from '../../lib/clinicalReportExport';

type Props = {
  open: boolean;
  onClose: () => void;
  sections: ClinicalReportSections;
  onChange: (sections: ClinicalReportSections) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  patientName?: string;
  doctorName?: string;
  doctorLicense?: string;
  doctorBhf?: string;
  appointmentDate?: string;
  icd10Code?: string;
  icd10SelectValue?: string;
  icd10CustomValue?: string;
  onIcd10SelectChange?: (value: string) => void;
  onIcd10CustomChange?: (value: string) => void;
  onDraftWithAyah?: () => void;
  onPreviewPdf?: (blobUrl: string) => void;
};

export function ClinicalReportModal({
  open,
  onClose,
  sections,
  onChange,
  onSave,
  saving,
  patientName,
  doctorName,
  doctorLicense,
  doctorBhf,
  appointmentDate,
  icd10Code,
  icd10SelectValue = '',
  icd10CustomValue = '',
  onIcd10SelectChange,
  onIcd10CustomChange,
  onDraftWithAyah,
  onPreviewPdf,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exportingDocx, setExportingDocx] = useState(false);

  useEffect(() => {
    if (!open) return;
    setExpanded(
      CLINICAL_REPORT_SECTIONS.reduce(
        (acc, section, index) => ({
          ...acc,
          [section.id]: index < 3 || Boolean(sections[section.id]?.trim()),
        }),
        {} as Record<string, boolean>,
      ),
    );
  }, [open, sections]);

  const filledCount = useMemo(
    () => CLINICAL_REPORT_SECTIONS.filter((s) => sections[s.id]?.trim()).length,
    [sections],
  );

  if (!open) return null;

  const updateSection = (id: keyof ClinicalReportSections, value: string) => {
    onChange({ ...sections, [id]: value });
  };

  const exportParams: ClinicalReportExportParams = {
    sections,
    patientName,
    doctorName,
    doctorLicense,
    doctorBhf,
    appointmentDate,
    icd10Code,
  };

  const handlePreview = () => {
    if (!clinicalReportHasContent(sections)) return;
    const blobUrl = createClinicalReportPdfBlobUrl(exportParams);
    if (onPreviewPdf) {
      onPreviewPdf(blobUrl);
      return;
    }
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadPdf = () => {
    if (!clinicalReportHasContent(sections)) return;
    downloadClinicalReportPdf(exportParams);
  };

  const handleDownloadDocx = async () => {
    if (!clinicalReportHasContent(sections)) return;
    try {
      setExportingDocx(true);
      await downloadClinicalReportDocx(exportParams);
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#e1e7ef] bg-white shadow-xl">
        <div className="relative shrink-0 border-b border-[#e1e7ef] px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8FA0B6]">
            History &amp; Physical (H&amp;P)
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Consultation report</h2>
          <p className="mt-1 text-sm text-[#65758b]">
            Structured clinical report — {filledCount} of {CLINICAL_REPORT_SECTIONS.length} sections
            completed. Download as PDF or Word (.docx).
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md border border-[#e1e7ef] p-1.5 text-gray-400 transition hover:bg-[#f8fafc] hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              ICD-10 diagnosis (optional)
            </label>
            <select
              value={icd10SelectValue}
              onChange={(e) => onIcd10SelectChange?.(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select diagnosis code</option>
              {COMMON_ICD10_CODES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code} - {entry.description}
                </option>
              ))}
              <option value="__custom__">Other (enter manually)</option>
            </select>
            {icd10SelectValue === '__custom__' ? (
              <input
                type="text"
                value={icd10CustomValue}
                onChange={(e) => onIcd10CustomChange?.(e.target.value)}
                placeholder="e.g. I10"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : null}
          </div>
          <div className="space-y-3">
            {CLINICAL_REPORT_SECTIONS.map((section) => {
              const isOpen = expanded[section.id] ?? true;
              return (
                <div
                  key={section.id}
                  className="rounded-xl border border-[#e1e7ef] bg-[#f8fafc]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [section.id]: !isOpen }))
                    }
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#0E2340]">{section.title}</p>
                      {section.hint ? (
                        <p className="mt-0.5 text-xs text-[#65758b]">{section.hint}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[#65758b]">
                      {sections[section.id]?.trim() ? 'Filled' : isOpen ? 'Open' : 'Empty'}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-[#e1e7ef] px-4 pb-4 pt-2">
                      <textarea
                        value={sections[section.id]}
                        onChange={(e) => updateSection(section.id, e.target.value)}
                        rows={section.rows}
                        placeholder={section.placeholder}
                        className="w-full rounded-lg border border-[#e1e7ef] bg-white px-3 py-2.5 text-sm leading-relaxed text-[#344256] outline-none transition focus:border-anixi-green focus:ring-2 focus:ring-anixi-green/20"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t border-[#e1e7ef] px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {onDraftWithAyah ? (
              <div className="flex w-full flex-col gap-1.5 sm:w-auto">
                <button
                  type="button"
                  onClick={onDraftWithAyah}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-[#427160]/30 bg-[#eef4f1] px-4 py-2 text-sm font-semibold text-[#427160] transition hover:bg-[#e3eee8]"
                >
                  <Sparkles className="h-4 w-4" />
                  Draft with Ayah
                </button>
                <p className="max-w-xs text-[11px] leading-snug text-[#65758b]">
                  Ayah pulls chart data and your visit note, then places a draft under For your review.
                  Tap Apply to report and you&apos;ll return here to edit.
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || !clinicalReportHasContent(sections)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-anixi-green px-4 py-2 text-sm font-medium text-white transition hover:bg-anixi-green/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save report'}
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!clinicalReportHasContent(sections)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              Preview PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!clinicalReportHasContent(sections)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadDocx()}
              disabled={!clinicalReportHasContent(sections) || exportingDocx}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {exportingDocx ? 'Preparing…' : 'Download DOCX'}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] border border-[#e1e7ef] bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-[#f3f6fa]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
