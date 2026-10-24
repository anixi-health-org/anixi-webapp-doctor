import React from 'react';

export type AppInviteChannel = 'whatsapp' | 'email' | 'whatsapp_and_email';

const BULK_APP_INVITE_MAX = 250;

type Props = {
  selectedCount: number;
  selectAllMatching: boolean;
  totalMatching: number;
  pagePatientCount: number;
  inviteChannel: AppInviteChannel;
  onInviteChannelChange: (channel: AppInviteChannel) => void;
  onSendAppInvite: () => void;
  inviteBusy: boolean;
  bulkDoctorId: string;
  onBulkDoctorChange: (doctorId: string) => void;
  clinicians: Array<{ uid: string; displayName?: string; email?: string }>;
  onAssign: (doctorId: string) => void;
  onUnassign: () => void;
  assignBusy: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
};

export function ClinicPatientBulkActions({
  selectedCount,
  selectAllMatching,
  totalMatching,
  pagePatientCount,
  inviteChannel,
  onInviteChannelChange,
  onSendAppInvite,
  inviteBusy,
  bulkDoctorId,
  onBulkDoctorChange,
  clinicians,
  onAssign,
  onUnassign,
  assignBusy,
  onSelectAllMatching,
  onClear,
}: Props) {
  const overInviteLimit = selectedCount > BULK_APP_INVITE_MAX;
  const showSelectAll =
    !selectAllMatching && totalMatching > pagePatientCount && selectedCount > 0;

  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-[#e1e7ef] bg-[#f8fafc] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#344256]">
            {selectAllMatching
              ? `${selectedCount.toLocaleString()} matching patients selected`
              : `${selectedCount} selected`}
          </p>
          {showSelectAll ? (
            <button
              type="button"
              onClick={onSelectAllMatching}
              className="mt-1 text-sm font-medium text-anixi-green hover:underline"
            >
              Select all {totalMatching.toLocaleString()} matching this search
            </button>
          ) : null}
          {overInviteLimit ? (
            <p className="mt-2 text-sm text-amber-800">
              WhatsApp invites: max {BULK_APP_INVITE_MAX} per batch, narrow your selection or
              filter the list.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={inviteBusy || assignBusy}
          className="self-start text-sm font-semibold text-[#65758b] hover:text-[#344256] disabled:opacity-50"
        >
          Clear selection
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-anixi-green/25 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-anixi-green">
            WhatsApp app invite
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[#65758b]">
            Sends the Anixi download link and clinic activation code via WhatsApp.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={inviteBusy || overInviteLimit}
              onClick={onSendAppInvite}
              className="inline-flex items-center justify-center rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {inviteBusy ? 'Sending…' : 'Send WhatsApp invite'}
            </button>
            <label className="flex items-center gap-2 text-sm text-[#65758b]">
              <span className="sr-only">Delivery channel</span>
              <select
                value={inviteChannel}
                onChange={(event) =>
                  onInviteChannelChange(event.target.value as AppInviteChannel)
                }
                disabled={inviteBusy}
                className="rounded-lg border border-[#e1e7ef] bg-white px-2 py-1.5 text-sm text-[#344256]"
                aria-label="App invite channel"
              >
                <option value="whatsapp">WhatsApp only</option>
                <option value="whatsapp_and_email">WhatsApp + email</option>
                <option value="email">Email only</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-[#e1e7ef] bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8FA0B6]">
            Assign doctor
          </h3>
          <p className="mt-1 text-sm text-[#65758b]">Set the primary clinician for selected roster rows.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              value={bulkDoctorId}
              onChange={(event) => onBulkDoctorChange(event.target.value)}
              disabled={assignBusy}
              className="min-w-[12rem] flex-1 rounded-lg border border-[#e1e7ef] px-2 py-2 text-sm"
              aria-label="Doctor to assign"
            >
              <option value="">Choose a doctor</option>
              {clinicians.map((clinician) => (
                <option key={clinician.uid} value={clinician.uid}>
                  {clinician.displayName || clinician.email || clinician.uid}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={assignBusy || !bulkDoctorId}
              onClick={() => onAssign(bulkDoctorId)}
              className="rounded-full bg-[#344256] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {assignBusy ? 'Assigning…' : 'Assign'}
            </button>
            <button
              type="button"
              disabled={assignBusy}
              onClick={onUnassign}
              className="rounded-full border border-[#e1e7ef] px-4 py-2 text-sm font-semibold text-[#344256] disabled:opacity-50"
            >
              Unassign
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export { BULK_APP_INVITE_MAX };
