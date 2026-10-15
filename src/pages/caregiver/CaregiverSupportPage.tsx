import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submitSupportRequest } from '../../services/supportService';
import { PageHeader, PageShell } from '../../components/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

export const CaregiverSupportPage: React.FC = () => {
  const { user } = useAuth();
  const [activeAccordion, setActiveAccordion] = useState<number | null>(0);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({ subject: '', message: '' });

  const faqs = [
    {
      question: 'How do I get linked to a patient?',
      answer:
        'Ask the patient or family member to open the Anixi mobile app, go to Medical Profile, enable caregiver, and enter your registered email address. Once saved, the patient will appear in your portal within a few minutes.',
    },
    {
      question: 'What can I see in the caregiver portal?',
      answer:
        'You can monitor medication adherence, mood trends, vitals, allergies, chronic conditions, and emergency contacts for patients who have designated you as their caregiver.',
    },
    {
      question: 'Can I edit a patient\'s medical information?',
      answer:
        'The caregiver portal is read-only for clinical data. Patients manage their own records in the mobile app. Contact their doctor for clinical changes.',
    },
    {
      question: 'I registered but no patients appear',
      answer:
        'Confirm the patient used the exact same email you registered with. Ask them to re-save their caregiver email in the app, then sign out and back in here to refresh your patient list.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!formData.subject.trim() || formData.message.trim().length < 10) {
      setErrorMessage('Please provide a subject and a message of at least 10 characters.');
      setFormStatus('error');
      return;
    }
    setFormStatus('submitting');
    try {
      await submitSupportRequest(user.id, formData.subject, formData.message);
      setFormStatus('success');
      setFormData({ subject: '', message: '' });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send message');
      setFormStatus('error');
    }
  };

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Support & Help"
        description="Guidance for caregivers using Anixi in hospitals, clinics, and community settings."
      />

      <div className="mb-8">
        <a
          href="mailto:support@anixihealth.com"
          className="block rounded-xl border border-anixi-green/20 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className="font-semibold text-gray-900">Email support</p>
          <p className="text-sm text-anixi-green">support@anixihealth.com</p>
        </a>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Frequently asked questions</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100 p-0">
          {faqs.map((faq, index) => (
            <div key={faq.question} className="px-6 py-4">
              <button
                type="button"
                onClick={() => setActiveAccordion(activeAccordion === index ? null : index)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900">{faq.question}</span>
                <span className="text-xl text-gray-400">{activeAccordion === index ? '−' : '+'}</span>
              </button>
              {activeAccordion === index && (
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{faq.answer}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact support</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Subject</label>
              <input
                name="subject"
                value={formData.subject}
                onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Message</label>
              <textarea
                name="message"
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-anixi-green focus:outline-none focus:ring-1 focus:ring-anixi-green"
              />
            </div>
            {formStatus === 'error' && errorMessage && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
            {formStatus === 'success' && (
              <p className="text-sm text-emerald-700">Message sent. We typically respond within 24 hours.</p>
            )}
            <button
              type="submit"
              disabled={formStatus === 'submitting'}
              className="rounded-lg bg-anixi-green px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {formStatus === 'submitting' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
};
