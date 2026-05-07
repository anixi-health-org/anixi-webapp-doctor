import { signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DOCTORS_COLLECTION } from '../shared/constants';
import { Doctor } from '../types';
export const loginDoctor = async (email: string, password: string): Promise<Doctor> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        const ref = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
        const doctorDoc = await getDoc(ref);
        if (!doctorDoc.exists()) {
            await signOut(auth);
            throw new Error('Access denied. This portal is for registered doctors only. Please use the Anixi patient app.');
        }
        const doctorData = doctorDoc.data();
        if (doctorData.role && doctorData.role !== 'doctor') {
            await signOut(auth);
            throw new Error('Access denied. This portal is for registered doctors only. Please use the Anixi patient app.');
        }
        return {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: doctorData.displayName || firebaseUser.displayName,
            role: 'doctor',
            specialty: doctorData.specialty,
            licenseNumber: doctorData.licenseNumber,
            phoneNumber: doctorData.phoneNumber,
            officeAddress: doctorData.officeAddress,
            createdAt: doctorData.createdAt?.toDate() || new Date(),
            updatedAt: doctorData.updatedAt?.toDate() || new Date(),
        } as Doctor;
    } catch (error: any) {
        ;
        throw new Error(error.message || "Login failed");
    }
};
        export const logoutDoctor = async (): Promise<void> => {
            try {
                await signOut(auth);
            } catch (error) {
                ;
                throw error;
            }
        };
        export const getCurrentDoctor = async (firebaseUser: User): Promise<Doctor | null> => {
            try {
                const ref = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
                const doctorDoc = await getDoc(ref);
                if (!doctorDoc.exists()) {
                    return null;
                }
                const doctorData = doctorDoc.data();
                if (doctorData.role && doctorData.role !== 'doctor') {
                    await signOut(auth);
                    return null;
                }
                return {
                    id: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    displayName: doctorData.displayName || firebaseUser.displayName || undefined,
                    role: 'doctor',
                    specialty: doctorData.specialty,
                    licenseNumber: doctorData.licenseNumber,
                    phoneNumber: doctorData.phoneNumber,
                    officeAddress: doctorData.officeAddress,
                    createdAt: doctorData.createdAt?.toDate() || new Date(),
                    updatedAt: doctorData.updatedAt?.toDate() || new Date(),
                } as Doctor;
            } catch (error) {
                ;
                return null;
            }
        };