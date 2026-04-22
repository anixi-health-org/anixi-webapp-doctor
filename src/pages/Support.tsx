import React, { useState } from 'react';

export const Support: React.FC = () => {
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
  });

  const faqs = [
    {
      question: 'How do I manage my patients?',
      answer: 'Go to "My Patients" to see all your connected patients. You can view their profiles, medical history, and appointments. Use the search function to quickly find specific patients.',
    },
    {
      question: 'How do I schedule appointments?',
      answer: 'Navigate to "Appointments" and click "New Appointment". Select a patient, choose a time slot, and add any notes. Patients will receive a notification.',
    },
    {
      question: 'How do I update my professional profile?',
      answer: 'Go to "Professional Profile" to edit your specialty, license number, office address, and other details. These changes are saved immediately.',
    },
    {
      question: 'How do I share Anixi with colleagues?',
      answer: 'Use the "Share Anixi" page to get your referral link or send email invitations. You can track how many people you\'ve referred.',
    },
    {
      question: 'How is my data secured?',
      answer: 'Anixi uses end-to-end encryption and HIPAA-compliant servers. All patient data is encrypted and securely stored in Firebase. We never share your data with third parties.',
    },
  ];

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) {
      setErrorMessage('Please fill in all fields');
      setFormStatus('error');
      return;
    }
    setFormStatus('success');
    setFormData({ subject: '', message: '' });
    setTimeout(() => {
      setFormStatus('idle');
    }, 5000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[#425950] mb-4">Support & Help</h1>
        <p className="text-lg text-gray-600">Find answers to common questions or contact our support team</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        <a href="https://docs.anixi.health">
          <h3 className="font-semibold text-gray-900 mb-1">Documentation</h3>
          <p className="text-sm text-gray-600">Read guides and tutorials</p>
        </a>
        <a href="mailto:support@anixi.health" className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border-l-4 border-purple-600">
          <h3 className="font-semibold text-gray-900 mb-1">Email Support</h3>
          <p className="text-sm text-gray-600">support@anixi.health</p>
        </a>
        <a href="https://status.anixi.health">
          <h3 className="font-semibold text-gray-900 mb-1">System Status</h3>
          <p className="text-sm text-gray-600">Check service status</p>
        </a>
      </div>

      <div className="bg-white rounded-lg shadow mb-12">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Frequently Asked Questions</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {faqs.map((faq, index) => (
            <div key={index} className="p-6">
              <button
                onClick={() => setActiveAccordion(activeAccordion === index ? null : index)}
                className="w-full text-left flex items-center justify-between hover:text-[#425950] transition-colors"
              >
                <h3 className="text-lg font-medium text-gray-900">{faq.question}</h3>
                <span className="text-2xl text-gray-400">
                  {activeAccordion === index ? '−' : '+'}
                </span>
              </button>
              {activeAccordion === index && (
                <p className="mt-4 text-gray-600 leading-relaxed">{faq.answer}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Contact Support</h2>
          <p className="text-gray-600 text-sm mt-1">Can't find what you're looking for? Send us a message</p>
        </div>
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleFormChange}
              placeholder="e.g., How to reset my password?"
              disabled={formStatus === 'submitting'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleFormChange}
              placeholder="Describe your issue or question in detail..."
              rows={5}
              disabled={formStatus === 'submitting'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimum 10 characters. Current: {formData.message.length}
            </p>
          </div>
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}
          {formStatus === 'success' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-medium text-green-900">Message sent!</p>
              <p className="text-sm text-green-700 mt-1">We'll get back to you within 24 hours</p>
            </div>
          )}
          <button
            type="submit"
            disabled={formStatus === 'submitting' || formStatus === 'success'}
            className={`w-full px-4 py-3 rounded-lg font-medium text-white transition-all ${
              formStatus === 'success'
                ? 'bg-green-600'
                : formStatus === 'submitting'
                ? 'bg-gray-400 cursor-not-allowed'
                : formStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {formStatus === 'submitting'
              ? 'Sending...'
              : formStatus === 'success'
              ? '✓ Sent!'
              : formStatus === 'error'
              ? 'Try Again'
              : 'Send Message'}
          </button>
        </form>
      </div>
      <div className="mt-8 bg-[#f0f2f1] border border-[#cbd5d2] rounded-lg p-6">
        <p className="text-[#425950]">
          <strong>Response Time:</strong> Our support team typically responds to messages within 24 hours during
          business days. For urgent issues, please call our emergency line.
        </p>
      </div>
    </div>
  );
};

export default Support;
