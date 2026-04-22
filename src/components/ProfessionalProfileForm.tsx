import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { updateDoctorProfile } from '../services/doctorService';
import { Doctor } from '../types';
import { customColors } from '../lib/customColors';

interface ProfessionalProfileFormData {
  title: string;
  fullName: string;
  gender: string;
  idOrPassport: string;
  nationality: string;

  phoneNumber: string;
  emailAddress: string;
  preferredContactMethod: string;
  websiteOrSocialLink?: string;

  hpcsaRegistrationNumber: string;
  medicalSpecialty: string;
  yearsOfExperience: string;
  hpcsaCertificate?: string;
  practiceLicenceUrl?: string;

  practiceType: string;
  practiceName: string;
  practiceNumber?: string;
  practiceFacility: string;
  province: string;
  city: string;
  practiceAddress: string;
}

const ProfessionalProfileForm: React.FC = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState<ProfessionalProfileFormData>({
    title: '',
    fullName: user?.displayName || '',
    gender: '',
    idOrPassport: '',
    nationality: '',

    phoneNumber: user?.phoneNumber || '',
    emailAddress: user?.email || '',
    preferredContactMethod: '',
    websiteOrSocialLink: '',

    hpcsaRegistrationNumber: user?.licenseNumber || '',
    medicalSpecialty: user?.specialty || '',
    yearsOfExperience: '',
    hpcsaCertificate: '',
    practiceLicenceUrl: '',

    practiceType: '',
    practiceName: '',
    practiceNumber: '',
    practiceFacility: '',
    province: '',
    city: '',
    practiceAddress: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setMessage('');

    try {
      const doctorData: Partial<Doctor> = {
        displayName: formData.fullName,
        specialty: formData.medicalSpecialty,
        licenseNumber: formData.hpcsaRegistrationNumber,
        phoneNumber: formData.phoneNumber,
        officeAddress: formData.practiceAddress,
      };

      await updateDoctorProfile(user.id, doctorData);
      setMessage('✅ Professional profile updated successfully!');
    } catch (error) {
      ;
      setMessage('❌ Failed to update profile. Please try again.');
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
      <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentStep(tab.id)}
            className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
              currentStep === tab.id
                ? 'bg-[#425950] text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>
    );
  };

  const renderPersonalInformation = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[#425950] mb-2">Personal Information</h2>
        <p className="text-gray-600">Tell us about yourself and your contact details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <select
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender <span className="text-red-500">*</span>
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ID or Passport <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="idOrPassport"
            value={formData.idOrPassport}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="emailAddress"
            value={formData.emailAddress}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preferred Contact Method <span className="text-red-500">*</span>
          </label>
          <select
            name="preferredContactMethod"
            value={formData.preferredContactMethod}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Website or Social Link <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="url"
            name="websiteOrSocialLink"
            value={formData.websiteOrSocialLink}
            onChange={handleInputChange}
            placeholder="https://example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nationality <span className="text-red-500">*</span>
          </label>
          <select
            name="nationality"
            value={formData.nationality}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[#425950] mb-2">Professional Information</h2>
        <p className="text-gray-600">Your medical credentials and experience</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            HPCSA Registration Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="hpcsaRegistrationNumber"
            value={formData.hpcsaRegistrationNumber}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Medical Specialty <span className="text-red-500">*</span>
          </label>
          <select
            name="medicalSpecialty"
            value={formData.medicalSpecialty}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Years of Experience <span className="text-red-500">*</span>
          </label>
          <select
            name="yearsOfExperience"
            value={formData.yearsOfExperience}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            HPCSA Certificate <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="url"
            name="hpcsaCertificate"
            value={formData.hpcsaCertificate}
            onChange={handleInputChange}
            placeholder="URL to certificate or upload link"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Licence URL <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="url"
            name="practiceLicenceUrl"
            value={formData.practiceLicenceUrl}
            onChange={handleInputChange}
            placeholder="URL to practice licence"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  const renderPracticeInformation = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-[#425950] mb-2">Practice Information</h2>
        <p className="text-gray-600">Details about your medical practice</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Type <span className="text-red-500">*</span>
          </label>
          <select
            name="practiceType"
            value={formData.practiceType}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="practiceName"
            value={formData.practiceName}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Number (BHF) <span className="text-gray-500">(optional)</span>
          </label>
          <input
            type="text"
            name="practiceNumber"
            value={formData.practiceNumber}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Facility <span className="text-red-500">*</span>
          </label>
          <select
            name="practiceFacility"
            value={formData.practiceFacility}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Province <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="province"
            value={formData.province}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="practiceAddress"
            value={formData.practiceAddress}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#425950] focus:border-transparent"
            required
          />
        </div>
      </div>
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

  return (
    <div className={`min-h-screen bg-[${customColors.backgroundMedium}] py-8`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#425950]">Professional Profile Setup</h1>
          <p className="mt-2 text-gray-600">Complete your professional profile</p>
        </div>

        {renderTabNavigation()}

        <Card>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit}>
              {renderCurrentStep()}

              {message && (
                <div className={`mt-6 p-4 rounded-lg ${
                  message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {message}
                </div>
              )}

              <div className="flex justify-end mt-8">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="px-8 py-3 bg-[#425950] text-white rounded-lg hover:bg-[#5a6f6a] disabled:opacity-50 transition-colors duration-200"
                >
                  {isLoading ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfessionalProfileForm;