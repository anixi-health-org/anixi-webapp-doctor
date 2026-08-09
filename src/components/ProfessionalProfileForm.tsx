import React, { useEffect, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { TabPill } from '../components/ui/TabPill';
import { PageHeader } from './page-layout/PageHeader';
import { PageShell } from './page-layout/PageShell';
import { LogoCropModal } from './LogoCropModal';
import { useAuth } from '../hooks/useAuth';
import { getDoctorProfileFormData, saveDoctorProfileForm } from '../services/doctorService';
import { updatePractice } from '../services/practiceSettingsService';
import {
  EMPTY_PROFILE_FORM,
  type ProfessionalProfileFormData,
} from '../types/doctorProfile';
import { PageHeaderSkeleton, Skeleton } from './ui/Skeleton';
import { isOnboardingFormComplete } from '../lib/doctorAccess';
import { detectBrowserTimezone, timezoneSelectOptions } from '../lib/timezones';
import { SA_PROVINCES, validateSouthAfricanId } from '../lib/southAfrica';

const ProfileFormSkeleton: React.FC = () => (
  <>
    <div className="mb-6 flex gap-2 rounded-[12px] border border-[#e1e7ef] bg-white p-1.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 flex-1 rounded-[10px]" />
      ))}
    </div>
    <div className="rounded-[12px] border border-[#e1e7ef] bg-white p-5 shadow-sm sm:p-8">
      <Skeleton className="mb-2 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-[10px]" />
          </div>
        ))}
      </div>
      <div className="mt-8 flex justify-between border-t border-[#eef2f6] pt-6">
        <Skeleton className="h-10 w-28 rounded-[10px]" />
        <Skeleton className="h-10 w-32 rounded-[10px]" />
      </div>
    </div>
  </>
);

const fieldClass =
  'h-11 w-full rounded-[10px] border border-[#e1e7ef] bg-white px-3 text-sm text-[#344256] placeholder:text-[#94a3b8] outline-none transition focus:border-[#427160] focus:ring-2 focus:ring-[#427160]/15';
const labelClass = 'mb-1.5 block text-sm font-medium text-[#344256]';
const sectionTitleClass = 'text-lg font-semibold text-[#344256]';
const sectionHintClass = 'mt-1 text-sm text-[#65758b]';
const btnPrimaryClass =
  'inline-flex h-10 items-center justify-center rounded-[10px] bg-[#427160] px-4 text-sm font-medium text-white transition-colors hover:bg-[#365c4f] disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondaryClass =
  'inline-flex h-10 items-center justify-center rounded-[10px] border border-[#e1e7ef] bg-white px-4 text-sm font-medium text-[#344256] transition-colors hover:border-[#427160]/40 hover:text-[#427160]';

interface ProfessionalProfileFormProps {
  mode?: 'settings' | 'onboarding';
  onSubmitted?: () => void | Promise<void>;
  /** Fires when the user moves between Personal / Professional / Practice tabs */
  onStepChange?: (step: number) => void;
}

const ProfessionalProfileForm: React.FC<ProfessionalProfileFormProps> = ({
  mode = 'settings',
  onSubmitted,
  onStepChange,
}) => {
  const isOnboarding = mode === 'onboarding';
  const { user, practiceSession, refreshPracticeSession } = useAuth();
  const doctor = user?.role === 'doctor' ? user : null;
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [idOrPassportError, setIdOrPassportError] = useState('');

  const [formData, setFormData] = useState<ProfessionalProfileFormData>({
    ...EMPTY_PROFILE_FORM,
    fullName: doctor?.displayName || '',
    phoneNumber: doctor?.phoneNumber || '',
    emailAddress: doctor?.email || '',
    hpcsaRegistrationNumber: doctor?.licenseNumber || '',
    medicalSpecialty: doctor?.specialty || '',
    practiceName: doctor?.practiceName || '',
    timezone: practiceSession?.practice?.timezone || detectBrowserTimezone(),
    practiceAddress: doctor?.officeAddress || '',
    logoUrl: doctor?.logoUrl || '',
  });

  useEffect(() => {
    if (!doctor?.id) {
      setIsProfileLoading(false);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        const saved = await getDoctorProfileFormData(doctor.id);
        if (cancelled) return;

        if (saved) {
          setFormData((prev) => ({
            ...prev,
            ...saved,
            emailAddress: saved.emailAddress || doctor.email || prev.emailAddress,
            fullName: saved.fullName || doctor.displayName || prev.fullName,
            timezone:
              saved.timezone ||
              practiceSession?.practice?.timezone ||
              detectBrowserTimezone(),
          }));
          if (saved.logoUrl) {
            setLogoPreview(saved.logoUrl);
          }
        } else {
          setFormData((prev) => ({
            ...prev,
            timezone:
              prev.timezone ||
              practiceSession?.practice?.timezone ||
              detectBrowserTimezone(),
          }));
        }
      } catch {
        if (!cancelled) {
          setMessage('Could not load your saved profile. You can still edit and save.');
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [doctor?.id, doctor?.displayName, doctor?.email, practiceSession?.practice?.timezone]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'idOrPassport') {
      setIdOrPassportError('');
    }
  };

  const validateIdOrPassport = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'ID or passport is required';
    if (/^\d+$/.test(trimmed)) {
      if (trimmed.length !== 13) {
        return 'South African ID must be exactly 13 digits';
      }
      const result = validateSouthAfricanId(trimmed);
      if (!result.valid) return result.error ?? 'Invalid South African ID number';
    } else if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      return 'Passport must contain only letters and numbers';
    }
    return null;
  };

  const handleIdOrPassportBlur = () => {
    const error = validateIdOrPassport(formData.idOrPassport);
    setIdOrPassportError(error ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    setIsLoading(true);
    setMessage('');

    try {
      const idError = validateIdOrPassport(formData.idOrPassport);
      if (idError) {
        setIdOrPassportError(idError);
        setMessage(idError);
        setIsLoading(false);
        return;
      }

      if (isOnboarding && !isOnboardingFormComplete(formData)) {
        setMessage(
          'Please complete all required personal, professional, and practice fields before submitting for review.'
        );
        setIsLoading(false);
        return;
      }

      let logoUrl: string | undefined = formData.logoUrl || doctor?.logoUrl;

      if (logoFile && doctor?.id) {
        setLogoUploading(true);
        const storageRef = ref(storage, `doctor-logos/${doctor.id}`);
        const snapshot = await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(snapshot.ref);
        setLogoUploading(false);
      }

      await saveDoctorProfileForm(doctor.id, formData, logoUrl, {
        submitForReview: isOnboarding,
      });

      const practiceId = practiceSession?.practice?.id;
      if (practiceId && (formData.practiceName.trim() || formData.timezone.trim())) {
        await updatePractice(practiceId, {
          ...(formData.practiceName.trim()
            ? { name: formData.practiceName.trim() }
            : {}),
          ...(formData.timezone.trim() ? { timezone: formData.timezone.trim() } : {}),
        });
        await refreshPracticeSession();
      }

      if (logoUrl) {
        setFormData((prev) => ({ ...prev, logoUrl: logoUrl as string }));
        setLogoPreview(logoUrl);
      }

      setLogoFile(null);
      setMessage(
        isOnboarding
          ? 'Application submitted for Anixi Admin review.'
          : 'Professional profile saved successfully.'
      );
      if (isOnboarding) {
        await onSubmitted?.();
      }
    } catch (error) {
      console.error('[ProfessionalProfileForm] save failed:', error);
      setMessage('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  const renderTabNavigation = () => {
    const tabs = [
      { id: 1, name: 'Personal', label: 'Personal Information' },
      { id: 2, name: 'Professional', label: 'Professional Information' },
      { id: 3, name: 'Practice', label: 'Practice Information' },
    ];

    return (
      <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-[12px] border border-[#e1e7ef] bg-white p-1.5 shadow-sm">
        {tabs.map((tab) => (
          <TabPill
            key={tab.id}
            onClick={() => setCurrentStep(tab.id)}
            active={currentStep === tab.id}
            className="min-w-0 flex-1 justify-center rounded-[10px] px-4 py-2.5"
          >
            {tab.name}
          </TabPill>
        ))}
      </div>
    );
  };

  const renderPersonalInformation = () => (
    <div className="space-y-6">
      <div className="border-b border-[#eef2f6] pb-4">
        <h2 className={sectionTitleClass}>Personal Information</h2>
        <p className={sectionHintClass}>Tell us about yourself and your contact details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>
            Title <span className="text-red-500">*</span>
          </label>
          <select
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Title</option>
            <option value="Dr">Dr</option>
            <option value="Prof">Prof</option>
            <option value="Mr">Mr</option>
            <option value="Mrs">Mrs</option>
            <option value="Ms">Ms</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Gender <span className="text-red-500">*</span>
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            ID or Passport <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="idOrPassport"
            value={formData.idOrPassport}
            onChange={handleInputChange}
            onBlur={handleIdOrPassportBlur}
            className={`${fieldClass}${idOrPassportError ? ' border-red-400 focus:border-red-400 focus:ring-red-400/15' : ''}`}
            required
          />
          {idOrPassportError && (
            <p className="mt-1 text-xs text-red-600">{idOrPassportError}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="emailAddress"
            value={formData.emailAddress}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Preferred Contact Method <span className="text-red-500">*</span>
          </label>
          <select
            name="preferredContactMethod"
            value={formData.preferredContactMethod}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Method</option>
            <option value="Phone">Phone</option>
            <option value="Email">Email</option>
            <option value="SMS">SMS</option>
            <option value="WhatsApp">WhatsApp</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Website or Social Link <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="url"
            name="websiteOrSocialLink"
            value={formData.websiteOrSocialLink}
            onChange={handleInputChange}
            placeholder="https://example.com"
            className={fieldClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>
            Nationality <span className="text-red-500">*</span>
          </label>
          <select
            name="nationality"
            value={formData.nationality}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Nationality</option>
            <option value="South African">South African</option>
            <option value="Zimbabwean">Zimbabwean</option>
            <option value="Botswana">Botswana</option>
            <option value="Namibian">Namibian</option>
            <option value="Mozambican">Mozambican</option>
            <option value="Swazi">Swazi</option>
            <option value="Lesotho">Lesotho</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderProfessionalInformation = () => (
    <div className="space-y-6">
      <div className="border-b border-[#eef2f6] pb-4">
        <h2 className={sectionTitleClass}>Professional Information</h2>
        <p className={sectionHintClass}>Your medical credentials and experience.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={labelClass}>
            HPCSA Registration Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="hpcsaRegistrationNumber"
            value={formData.hpcsaRegistrationNumber}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Medical Specialty <span className="text-red-500">*</span>
          </label>
          <select
            name="medicalSpecialty"
            value={formData.medicalSpecialty}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Specialty</option>
            <option value="General Practice">General Practice</option>
            <option value="Internal Medicine">Internal Medicine</option>
            <option value="Pediatrics">Pediatrics</option>
            <option value="Obstetrics & Gynecology">Obstetrics & Gynecology</option>
            <option value="Surgery">Surgery</option>
            <option value="Orthopedics">Orthopedics</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Dermatology">Dermatology</option>
            <option value="Psychiatry">Psychiatry</option>
            <option value="Radiology">Radiology</option>
            <option value="Anesthesiology">Anesthesiology</option>
            <option value="Emergency Medicine">Emergency Medicine</option>
            <option value="Ophthalmology">Ophthalmology</option>
            <option value="ENT">ENT (Ear, Nose & Throat)</option>
            <option value="Urology">Urology</option>
            <option value="Neurology">Neurology</option>
            <option value="Oncology">Oncology</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Years of Experience <span className="text-red-500">*</span>
          </label>
          <select
            name="yearsOfExperience"
            value={formData.yearsOfExperience}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Experience</option>
            <option value="0-2">0-2 years</option>
            <option value="3-5">3-5 years</option>
            <option value="6-10">6-10 years</option>
            <option value="11-15">11-15 years</option>
            <option value="16-20">16-20 years</option>
            <option value="21-25">21-25 years</option>
            <option value="26+">26+ years</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            HPCSA Certificate <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="url"
            name="hpcsaCertificate"
            value={formData.hpcsaCertificate}
            onChange={handleInputChange}
            placeholder="URL to certificate or upload link"
            className={fieldClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>
            Practice Licence URL <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="url"
            name="practiceLicenceUrl"
            value={formData.practiceLicenceUrl}
            onChange={handleInputChange}
            placeholder="URL to practice licence"
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );

  const renderPracticeInformation = () => (
    <div className="space-y-6">
      <div className="border-b border-[#eef2f6] pb-4">
        <h2 className={sectionTitleClass}>Practice Information</h2>
        <p className={sectionHintClass}>
          Details about your medical practice, including the name and timezone used for scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={labelClass}>
            Practice Type <span className="text-red-500">*</span>
          </label>
          <select
            name="practiceType"
            value={formData.practiceType}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Practice Type</option>
            <option value="Solo Practice">Solo Practice</option>
            <option value="Group Practice">Group Practice</option>
            <option value="Hospital-based">Hospital-based</option>
            <option value="Academic/Research">Academic/Research</option>
            <option value="Locum">Locum</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Practice Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="practiceName"
            value={formData.practiceName}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Timezone <span className="text-red-500">*</span>
          </label>
          <select
            name="timezone"
            value={formData.timezone}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select timezone</option>
            {timezoneSelectOptions(formData.timezone).map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[#65758b]">
            Used for clinic hours, calendar, and appointment times.
          </p>
        </div>

        <div>
          <label className={labelClass}>
            Practice Number (BHF) <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            name="practiceNumber"
            value={formData.practiceNumber}
            onChange={handleInputChange}
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            VAT Number <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            name="vatNumber"
            value={formData.vatNumber}
            onChange={handleInputChange}
            placeholder="e.g. 4123456789"
            className={fieldClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            Practice Facility <span className="text-red-500">*</span>
          </label>
          <select
            name="practiceFacility"
            value={formData.practiceFacility}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select Practice Facility</option>
            <option value="Private Clinic">Private Clinic</option>
            <option value="Public Hospital">Public Hospital</option>
            <option value="Private Hospital">Private Hospital</option>
            <option value="Day Hospital">Day Hospital</option>
            <option value="Community Health Center">Community Health Center</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>
            Province <span className="text-red-500">*</span>
          </label>
          <select
            name="province"
            value={formData.province.toLowerCase()}
            onChange={handleInputChange}
            className={fieldClass}
            required
          >
            <option value="">Select province</option>
            {SA_PROVINCES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>
            Practice Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="practiceAddress"
            value={formData.practiceAddress}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
        </div>

        {/* Practice Logo for Letterhead */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            Practice Logo <span className="font-normal text-[#94a3b8]">(invoices & letterhead)</span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[#e1e7ef] bg-[#f8fafc]">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Practice logo preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="px-2 text-center text-[11px] text-[#94a3b8]">No logo</span>
              )}
            </div>
            <label className="cursor-pointer flex-1">
              <div className="flex h-20 w-full flex-col items-center justify-center rounded-[12px] border border-dashed border-[#c5ced9] bg-[#f8fafc] px-3 text-center transition hover:border-[#427160] hover:bg-[#eef4f1]">
                <span className="text-sm font-medium text-[#344256]">
                  {logoUploading
                    ? 'Uploading…'
                    : logoPreview
                      ? 'Change logo'
                      : 'Upload logo (PNG or JPG)'}
                </span>
                <span className="mt-1 text-xs text-[#94a3b8]">
                  Square crop recommended · Min 200×200 px
                </span>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  if (file) {
                    const src = URL.createObjectURL(file);
                    setCropImageSrc(src);
                    setCropModalOpen(true);
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {cropImageSrc && (
        <LogoCropModal
          isOpen={cropModalOpen}
          imageSrc={cropImageSrc}
          onClose={() => {
            setCropModalOpen(false);
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
          }}
          onCropComplete={(file, previewUrl) => {
            if (logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview);
            }
            setLogoFile(file);
            setLogoPreview(previewUrl);
            URL.revokeObjectURL(cropImageSrc);
            setCropImageSrc(null);
          }}
        />
      )}
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderPersonalInformation();
      case 2:
        return renderProfessionalInformation();
      case 3:
        return renderPracticeInformation();
      default:
        return renderPersonalInformation();
    }
  };

  if (isProfileLoading) {
    if (isOnboarding) {
      return <ProfileFormSkeleton />;
    }
    return (
      <PageShell>
        <PageHeaderSkeleton />
        <ProfileFormSkeleton />
      </PageShell>
    );
  }

  const formCard = (
    <>
      {renderTabNavigation()}

      <div className="rounded-[12px] border border-[#e1e7ef] bg-white shadow-sm">
        <div className="p-5 sm:p-8">
          <form onSubmit={handleSubmit}>
            {renderCurrentStep()}

            {message && (
              <div
                className={`mt-6 rounded-[12px] p-4 text-sm ${
                  message.includes('successfully') || message.includes('submitted')
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : message.includes('Could not load') || message.includes('required')
                      ? 'border border-amber-200 bg-amber-50 text-amber-800'
                      : 'border border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {message}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-[#eef2f6] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                    className={btnSecondaryClass}
                  >
                    Back
                  </button>
                )}
                {currentStep < 3 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
                    className={btnPrimaryClass}
                  >
                    Continue
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isLoading || logoUploading}
                className={btnPrimaryClass}
              >
                {isLoading
                  ? isOnboarding
                    ? 'Submitting...'
                    : 'Saving...'
                  : isOnboarding
                    ? 'Submit for review'
                    : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );

  if (isOnboarding) {
    return formCard;
  }

  return (
    <PageShell>
      <PageHeader
        title="Professional Profile"
        description="Keep your personal, professional, and practice details up to date."
      />
      {formCard}
    </PageShell>
  );
};

export default ProfessionalProfileForm;
export { ProfessionalProfileForm };
