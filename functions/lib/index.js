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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReferralInvitation = void 0;
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
            console.warn('[sendReferralInvitation] no sendgrid key configured; skipping email send');
        }
        else {
            await mail_1.default.send({
                to: data.targetEmail,
                from: FROM_EMAIL,
                subject,
                html,
            });
        }
        await snap.ref.update({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    catch (err) {
        console.error('Failed to send invite email', err);
        await snap.ref.update({ sendError: String(err) });
    }
});
