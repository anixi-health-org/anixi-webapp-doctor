"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAutoCancellationRules = exports.sendReferralInvitationTest = exports.sendReferralInvitation = exports.sendReferralInvitationCallable = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
admin.initializeApp();
const db = admin.firestore();
const SENDGRID_API_KEY = functions.config().sendgrid?.key || process.env.SENDGRID_API_KEY;
const FROM_EMAIL = functions.config().invite?.from || process.env.INVITE_FROM_EMAIL || 'no-reply@anixi.app';
const IOS_LINK = functions.config().invite?.ios || process.env.IOS_DOWNLOAD_LINK || 'https://apps.apple.com';
const ANDROID_LINK = functions.config().invite?.android || process.env.ANDROID_DOWNLOAD_LINK || 'https://play.google.com';
const WEB_SIGNUP = functions.config().invite?.web || process.env.WEB_SIGNUP_URL || 'https://app.anixi.health/sign-up';
if (SENDGRID_API_KEY)
    mail_1.default.setApiKey(SENDGRID_API_KEY);
exports.sendReferralInvitationCallable = functions.https.onCall(async (data, context) => {
    const doctorId = String(data.doctorId || '');
    const targetEmail = String(data.targetEmail || '');
    if (!doctorId || !targetEmail) {
        throw new functions.https.HttpsError('invalid-argument', 'doctorId and targetEmail are required');
    }
    if (!SENDGRID_API_KEY) {
        throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key is not configured');
    }
    const refDoc = await db.collection('referrals').doc(doctorId).get();
    const refData = refDoc.exists ? refDoc.data() : null;
    const referralLink = refData?.referralLink || `${WEB_SIGNUP}?ref=${refData?.referralCode || doctorId}`;
    const subject = `You're invited to join Anixi`;
    const html = `
      <p>Hello,</p>
      <p>${refData?.doctorName || 'A doctor'} invited you to join Anixi — a care coordination app.</p>
      <p>Sign up on the web: <a href="${referralLink}">${referralLink}</a></p>
      <p>Or download the app:</p>
      <ul>
        <li><a href="${IOS_LINK}">Download on the App Store</a></li>
        <li><a href="${ANDROID_LINK}">Get it on Google Play</a></li>
      </ul>
      <p>If you have any trouble, reply to this email.</p>
      <p>— The Anixi team</p>
    `;
    try {
        await mail_1.default.send({
            to: targetEmail,
            from: FROM_EMAIL,
            subject,
            html,
        });
        return { status: 'sent' };
    }
    catch (error) {
        const message = error?.message || String(error);
        throw new functions.https.HttpsError('internal', message);
    }
});
exports.sendReferralInvitation = functions.firestore
    .document('referrals/{doctorId}/invitations/{invId}')
    .onCreate(async (snap, context) => {
    const { doctorId } = context.params;
    const data = snap.data();
    if (!data)
        return;
    if (data.method !== 'email' || !data.targetEmail)
        return;
    // load referral link/code
    const refDoc = await db.collection('referrals').doc(doctorId).get();
    const refData = refDoc.exists ? refDoc.data() : null;
    const referralLink = refData?.referralLink || `${WEB_SIGNUP}?ref=${refData?.referralCode || doctorId}`;
    const inviteUrl = referralLink;
    const subject = `You're invited to join Anixi`;
    const html = `
      <p>Hello,</p>
      <p>${refData?.doctorName || 'A doctor'} invited you to join Anixi — a care coordination app.</p>
      <p>Sign up on the web: <a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Or download the app:</p>
      <ul>
        <li><a href="${IOS_LINK}">Download on the App Store</a></li>
        <li><a href="${ANDROID_LINK}">Get it on Google Play</a></li>
      </ul>
      <p>If you have any trouble, reply to this email.</p>
      <p>— The Anixi team</p>
    `;
    try {
        if (!SENDGRID_API_KEY) {
            const msg = '[sendReferralInvitation] SendGrid API key not configured; skipping email send';
            console.warn(msg);
            await snap.ref.update({
                status: 'failed',
                sendError: msg,
                attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
        }
        await mail_1.default.send({
            to: data.targetEmail,
            from: FROM_EMAIL,
            subject,
            html,
        });
        await snap.ref.update({
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        console.error('Failed to send invite email', err);
        await snap.ref.update({
            status: 'failed',
            sendError: String(err),
            attemptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
// Previously an unauthenticated HTTP endpoint that sent referral email.
// It must not remain publicly callable. Deploy this stub so existing URLs 403.
exports.sendReferralInvitationTest = functions.https.onRequest(async (_req, res) => {
    res.status(403).json({
        error: 'This test endpoint is disabled. Use the authenticated referral invitation flow.',
    });
});
/**
 * Scheduled Cloud Function to apply auto-cancellation rule to pending appointments
 * Runs every hour to catch appointments whose time has passed
 */
exports.applyAutoCancellationRules = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
    try {
        console.log('Starting auto-cancellation process for pending appointments');
        const now = new Date();
        let processedCount = 0;
        let cancelledCount = 0;
        let errorCount = 0;
        // Query all pending appointments from global collection
        const appointmentsRef = db.collection('appointments');
        const query = appointmentsRef.where('status', '==', 'pending');
        const snapshot = await query.get();
        console.log(`Found ${snapshot.size} pending appointments to process`);
        for (const doc of snapshot.docs) {
            processedCount++;
            try {
                const data = doc.data();
                const appointmentId = doc.id;
                const doctorId = data.doctorId;
                const patientId = data.patientId;
                const currentStatus = String(data.status || '');
                if (currentStatus === 'no_show' || currentStatus === 'confirmed' || currentStatus === 'completed') {
                    continue;
                }
                if (currentStatus !== 'pending' && currentStatus !== 'rescheduled') {
                    continue;
                }
                let appointmentDateTime = null;
                if (data.scheduledAt instanceof admin.firestore.Timestamp) {
                    appointmentDateTime = data.scheduledAt.toDate();
                }
                else if (data.startAt instanceof admin.firestore.Timestamp) {
                    appointmentDateTime = data.startAt.toDate();
                }
                else if (data.date instanceof admin.firestore.Timestamp) {
                    appointmentDateTime = data.date.toDate();
                    const timeString = data.time;
                    if (timeString && typeof timeString === 'string') {
                        const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
                        if (timeMatch) {
                            let hours = parseInt(timeMatch[1], 10);
                            const minutes = parseInt(timeMatch[2], 10);
                            const period = timeMatch[3];
                            if (period) {
                                if (period.toUpperCase() === 'PM' && hours !== 12)
                                    hours += 12;
                                else if (period.toUpperCase() === 'AM' && hours === 12)
                                    hours = 0;
                            }
                            appointmentDateTime.setHours(hours, minutes, 0, 0);
                        }
                    }
                }
                if (!appointmentDateTime || appointmentDateTime > now) {
                    continue;
                }
                const autoCancelPayload = {
                    status: 'auto_cancelled',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    autoCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                await doc.ref.update(autoCancelPayload);
                if (doctorId) {
                    const doctorRef = db.collection('Users').doc(doctorId).collection('appointments').doc(appointmentId);
                    const doctorDoc = await doctorRef.get();
                    if (doctorDoc.exists) {
                        await doctorRef.update(autoCancelPayload);
                    }
                }
                if (patientId && !String(patientId).startsWith('manual_')) {
                    const patientRef = db.collection('Users').doc(patientId).collection('appointments').doc(appointmentId);
                    const patientDoc = await patientRef.get();
                    if (patientDoc.exists) {
                        await patientRef.update(autoCancelPayload);
                    }
                }
                cancelledCount++;
                console.log(`Auto-cancelled appointment ${appointmentId} (Doctor: ${doctorId})`);
            }
            catch (error) {
                errorCount++;
                console.error(`Error processing appointment ${doc.id}:`, error?.message || error);
            }
        }
        console.log(`Auto-cancellation process completed. Processed: ${processedCount}, Cancelled: ${cancelledCount}, Errors: ${errorCount}`);
        return {
            processed: processedCount,
            cancelled: cancelledCount,
            errors: errorCount,
        };
    }
    catch (error) {
        console.error('Error in applyAutoCancellationRules:', error?.message || error);
        throw error;
    }
});
