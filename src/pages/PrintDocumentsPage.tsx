import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

const PrintDocumentsPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Print documents</h1>

      <Card>
        <CardHeader>
          <CardTitle>Print documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">For manual patients, documents can be printed locally.</p>

          <div className="mt-4 space-y-3">
            <button onClick={() => navigate(`/invoices/new/${appointmentId}`)} className="w-full px-4 py-3 rounded-lg border text-left">Open invoice</button>
            <button onClick={() => navigate(`/appointments/${appointmentId}/post-consult`)} className="w-full px-4 py-3 rounded-lg border text-left">Open internal note</button>
            <button onClick={() => navigate(`/appointments/${appointmentId}`)} className="w-full px-4 py-3 rounded-lg border text-left">Done</button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrintDocumentsPage;
