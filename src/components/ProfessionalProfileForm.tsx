import React, { useEffect, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TabPill } from '../components/ui/TabPill';
import { PageHeader } from './page-layout/PageHeader';
import { PageShell } from './page-layout/PageShell';
import { LogoCropModal } from './LogoCropModal';
import { useAuth } from '../hooks/useAuth';
import { getDoctorProfileFormData, saveDoctorProfileForm } from '../services/doctorService';
import {
  EMPTY_PROFILE_FORM,
  type ProfessionalProfileFormData,
} from '../types/doctorProfile';
import { CardSkeleton } from './ui/Skeleton';

const fieldClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-anixi-green focus:outline-none focus:ring-2 focus:ring-anixi-green/15';
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700';

const ProfessionalProfileForm: React.FC = () => {
  const { user } = useAuth();
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

  const [formData, setFormData] = useState<ProfessionalProfileFormData>({
    ...EMPTY_PROFILE_FORM,
    fullName: doctor?.displayName || '',
    phoneNumber: doctor?.phoneNumber || '',
    emailAddress: doctor?.email || '',
    hpcsaRegistrationNumber: doctor?.licenseNumber || '',
    medicalSpecialty: doctor?.specialty || '',
    practiceName: doctor?.practiceName || '',
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
          }));
          if (saved.logoUrl) {
            setLogoPreview(saved.logoUrl);
          }
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
  }, [doctor?.id, doctor?.displayName, doctor?.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;

    setIsLoading(true);
    setMessage('');

    try {
      let logoUrl: string | undefined = formData.logoUrl || doctor?.logoUrl;

      if (logoFile && doctor?.id) {
        setLogoUploading(true);
        const storageRef = ref(storage, `doctor-logos/${doctor.id}`);
        const snapshot = await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(snapshot.ref);
        setLogoUploading(false);
      }

      await saveDoctorProfileForm(doctor.id, formData, logoUrl);

      if (logoUrl) {
        setFormData((prev) => ({ ...prev, logoUrl: logoUrl as string }));
        setLogoPreview(logoUrl);
      }

      setLogoFile(null);
      setMessage('Professional profile saved successfully.');
    } catch (error) {
      console.error('[ProfessionalProfileForm] save failed:', error);
      setMessage('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderTabNavigation = () => {
    const tabs = [
      { id: 1, name: 'Personal', label: 'Personal Information' },
      { id: 2, name: 'Professional', label: 'Professional Information' },
      { id: 3, name: 'Practice', label: 'Practice Information' },
    ];

    return (
      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
        {tabs.map((tab) => (
          <TabPill
            key={tab.id}
            onClick={() => setCurrentStep(tab.id)}
            active={currentStep === tab.id}
            className="flex-1 justify-center rounded-xl px-4 py-2.5"
          >
            {tab.name}
          </TabPill>
        ))}
      </div>
    );
  };

  const renderPersonalInformation = () => (
    <div className="space-y-6">
      <div className="border-b border-gray-100 pb-4">
        <h2 className="font-heading text-lg font-semibold text-anixi-green">Personal Information</h2>
        <p className="mt-1 text-sm text-gray-500">Tell us about yourself and your contact details</p>
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
            className={fieldClass}
            required
          />
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
      <div className="border-b border-gray-100 pb-4">
        <h2 className="font-heading text-lg font-semibold text-anixi-green">Professional Information</h2>
        <p className="mt-1 text-sm text-gray-500">Your medical credentials and experience</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      <div className="border-b border-gray-100 pb-4">
        <h2 className="font-heading text-lg font-semibold text-anixi-green">Practice Information</h2>
        <p className="mt-1 text-sm text-gray-500">Details about your medical practice</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <input
            type="text"
            name="province"
            value={formData.province}
            onChange={handleInputChange}
            className={fieldClass}
            required
          />
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
            Practice Logo <span className="text-gray-500">(used on invoices &amp; letterhead)</span>
          </label>
          <div className="flex items-center gap-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Practice logo preview"
                className="w-16 h-16 object-contain rounded border border-gray-200 bg-gray-50"
              />
            )}
            <label className="cursor-pointer flex-1">
              <div className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-[#425950] hover:text-[#425950] transition text-center">
                {logoUploading ? 'Uploading…' : logoPreview ? 'Change logo' : 'Upload logo (PNG or JPG)'}
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
          <p className="mt-1 text-xs text-gray-500">Square crop recommended. Min 200×200 px for invoices.</p>
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
    return (
      <PageShell>
        <PageHeader
          title="Professional Profile"
          description="Keep your personal, professional, and practice details up to date."
        />
        <CardSkeleton rows={8} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Professional Profile"
        description="Keep your personal, professional, and practice details up to date."
      />

      {renderTabNavigation()}

      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-5 sm:p-8">
          <form onSubmit={handleSubmit}>
            {renderCurrentStep()}

            {message && (
              <div
                className={`mt-6 rounded-xl p-4 text-sm ${
                  message.includes('successfully')
                    ? 'bg-emerald-50 text-emerald-800'
                    : message.includes('Could not load')
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-red-50 text-red-800'
                }`}
              >
                {message}
              </div>
            )}

            <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
              <Button
                type="submit"
                disabled={isLoading}
                className="rounded-xl bg-anixi-green px-8 py-2.5 text-white hover:bg-anixi-green/90 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default ProfessionalProfileForm;