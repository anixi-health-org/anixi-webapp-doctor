import { signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DOCTORS_COLLECTION, USERS_COLLECTION } from '../shared/constants';
import { Doctor } from '../types';
export const loginDoctor = async (email: string, password: string): Promise<Doctor> => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        let isDoctor = false;

        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData.role === 'doctor') {
                isDoctor = true;
            } else if (!userData.role) {
                const doctorRef = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
                const doctorDoc = await getDoc(doctorRef);
                
                if (doctorDoc.exists()) {
                    await setDoc(userRef, {
                        ...userData,
                        role: 'doctor',
                        updatedAt: new Date(),
                    }, { merge: true });
                    isDoctor = true;
                }
            }
        } else {
            const doctorRef = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
            const doctorDoc = await getDoc(doctorRef);

            if (doctorDoc.exists()) {
                await setDoc(userRef, {
                    id: firebaseUser.uid,
                    email: firebaseUser.email,
                    role: 'doctor',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                isDoctor = true;
            }
        }

        if (!isDoctor) {
            throw new Error("Access denied. Only doctors can access this application.");
        }

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
            practiceName: doctorData.practiceName,
            logoUrl: doctorData.logoUrl,
            createdAt: doctorData.createdAt?.toDate() || new Date(),
            updatedAt: doctorData.updatedAt?.toDate() || new Date(),
        } as Doctor;
    } catch (error: any) {
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
                const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
                const userDoc = await getDoc(userRef);

                let isDoctor = false;

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    
                    if (userData.role === 'doctor') {
                        isDoctor = true;
                    } else if (!userData.role) {
                        const doctorRef = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
                        const doctorDoc = await getDoc(doctorRef);
                        
                        if (doctorDoc.exists()) {
                            await setDoc(userRef, {
                                ...userData,
                                role: 'doctor',
                                updatedAt: new Date(),
                            }, { merge: true });
                            isDoctor = true;
                        }
                    }
                } else {
                    const doctorRef = doc(db, DOCTORS_COLLECTION, firebaseUser.uid);
                    const doctorDoc = await getDoc(doctorRef);

                    if (doctorDoc.exists()) {
                        await setDoc(userRef, {
                            id: firebaseUser.uid,
                            email: firebaseUser.email,
                            role: 'doctor',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                        isDoctor = true;
                    }
                }

                if (!isDoctor) {
                    return null;
                }

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
                    practiceName: doctorData.practiceName,
                    logoUrl: doctorData.logoUrl,
                    createdAt: doctorData.createdAt?.toDate() || new Date(),
                    updatedAt: doctorData.updatedAt?.toDate() || new Date(),
                } as Doctor;
            } catch (error) {
                return null;
            }
        };