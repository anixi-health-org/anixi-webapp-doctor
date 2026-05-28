import React, { useEffect, useState } from 'react';
import { Patient } from '../../types';

interface TreatmentFormRow {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
}

interface Props {
  isOpen: boolean;
  patient: Patient;
  onClose: () => void;
  onSave: (updates: Partial<Patient>) => Promise<void>;
}

function parseListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatListInput(items?: string[]): string {
  return (items || []).join('\n');
}

export const EditMedicalInfoModal: React.FC<Props> = ({ isOpen, patient, onClose, onSave }) => {
  const [aidProvider, setAidProvider] = useState('');
  const [aidMemberNumber, setAidMemberNumber] = useState('');
  const [aidGroupNumber, setAidGroupNumber] = useState('');
  const [chronicDiseasesText, setChronicDiseasesText] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [treatments, setTreatments] = useState<TreatmentFormRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAidProvider(patient.medicalAid?.provider || '');
    setAidMemberNumber(patient.medicalAid?.memberNumber || '');
    setAidGroupNumber(patient.medicalAid?.groupNumber || '');
    setChronicDiseasesText(formatListInput(patient.chronicDiseases));
    setAllergiesText(formatListInput(patient.allergies));
    setTreatments(
      (patient.currentTreatments || []).map((t) => ({
        name: t.name || '',
        dosage: t.dosage || '',
        frequency: t.frequency || '',
        startDate: t.startDate
          ? new Date(t.startDate).toISOString().substring(0, 10)
          : '',
      }))
    );
    if ((patient.currentTreatments || []).length === 0) {
      setTreatments([{ name: '', dosage: '', frequency: '', startDate: '' }]);
    }
    setError(null);
  }, [isOpen, patient]);

  if (!isOpen) return null;

  const updateTreatment = (index: number, field: keyof TreatmentFormRow, value: string) => {
    setTreatments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const addTreatment = () => {
    setTreatments((prev) => [...prev, { name: '', dosage: '', frequency: '', startDate: '' }]);
  };

  const removeTreatment = (index: number) => {
    setTreatments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const chronicDiseases = parseListInput(chronicDiseasesText);
      const allergies = parseListInput(allergiesText);
      const currentTreatments = treatments
        .filter((t) => t.name.trim())
        .map((t) => ({
          name: t.name.trim(),
          dosage: t.dosage.trim(),
          frequency: t.frequency.trim(),
          startDate: t.startDate ? new Date(t.startDate) : new Date(),
        }));

      const hasMedicalAid =
        aidProvider.trim() || aidMemberNumber.trim() || aidGroupNumber.trim();

      const updates: Partial<Patient> = {
        chronicDiseases,
        allergies,
        currentTreatments,
        medicalAid: hasMedicalAid
          ? {
              provider: aidProvider.trim(),
              memberNumber: aidMemberNumber.trim(),
              ...(aidGroupNumber.trim() ? { groupNumber: aidGroupNumber.trim() } : {}),
            }
          : undefined,
      };

      await onSave(updates);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save medical information');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl border border-[#E4EAF2]">
        <div className="px-5 py-4 border-b border-[#E4EAF2] bg-[#425950]">
          <h2 className="text-lg font-bold text-white">Medical Information</h2>
          <p className="text-sm text-white/75 mt-0.5">{patient.displayName}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <section>
            <h3 className="text-sm font-semibold text-[#425950] mb-2">Medical aid</h3>
            <div className="space-y-2">
              <input
                value={aidProvider}
                onChange={(e) => setAidProvider(e.target.value)}
                placeholder="Provider (e.g. Discovery)"
                className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm"
              />
              <input
                value={aidMemberNumber}
                onChange={(e) => setAidMemberNumber(e.target.value)}
                placeholder="Member number"
                className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm"
              />
              <input
                value={aidGroupNumber}
                onChange={(e) => setAidGroupNumber(e.target.value)}
                placeholder="Group number (optional)"
                className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm"
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#425950] mb-2">Medical history</h3>
            <p className="text-xs text-gray-500 mb-1">One condition per line</p>
            <textarea
              value={chronicDiseasesText}
              onChange={(e) => setChronicDiseasesText(e.target.value)}
              placeholder="Hypertension&#10;Type 2 Diabetes"
              rows={3}
              className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm resize-y"
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#425950] mb-2">Allergies</h3>
            <p className="text-xs text-gray-500 mb-1">One allergy per line</p>
            <textarea
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              placeholder="Penicillin&#10;Peanuts"
              rows={2}
              className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm resize-y"
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#425950]">Current treatments</h3>
              <button
                type="button"
                onClick={addTreatment}
                className="text-xs font-medium text-[#425950] hover:underline"
              >
                + Add medication
              </button>
            </div>
            <div className="space-y-3">
              {treatments.map((treatment, index) => (
                <div
                  key={index}
                  className="p-3 border border-[#E7EDF4] rounded-xl bg-[#FAFBFC] space-y-2"
                >
                  <input
                    value={treatment.name}
                    onChange={(e) => updateTreatment(index, 'name', e.target.value)}
                    placeholder="Medication name"
                    className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={treatment.dosage}
                      onChange={(e) => updateTreatment(index, 'dosage', e.target.value)}
                      placeholder="Dosage"
                      className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm bg-white"
                    />
                    <input
                      value={treatment.frequency}
                      onChange={(e) => updateTreatment(index, 'frequency', e.target.value)}
                      placeholder="Frequency"
                      className="w-full px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="date"
                      value={treatment.startDate}
                      onChange={(e) => updateTreatment(index, 'startDate', e.target.value)}
                      className="flex-1 px-3 py-2 border border-[#E7EDF4] rounded-lg text-sm bg-white"
                    />
                    {treatments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTreatment(index)}
                        className="text-xs text-red-600 hover:underline px-2"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-[#E4EAF2] bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 border border-[#E4EAF2] rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-[#425950] text-white rounded-xl hover:bg-[#344842] disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
