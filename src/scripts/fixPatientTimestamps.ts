
import { collection, getDocs, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const fixPatientTimestamps = async () => {
  console.log('\n🔧 FIXING PATIENT TIMESTAMPS...\n');
  
  try {
    console.log('📋 Step 1: Fetching all patients from Users collection...');
    const patientsRef = collection(db, 'Users');
    const snapshot = await getDocs(patientsRef);
    
    console.log(`   ✓ Found ${snapshot.size} users total\n`);
    
    let patientsCount = 0;
    let fixedCount = 0;
    let alreadyHaveTimestamps = 0;
    
    console.log('🔍 Step 2: Checking timestamps for each patient...\n');
    
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      if (userData.role !== 'patient') {
        continue;
      }
      
      patientsCount++;
      const name = userData.displayName || 'Unknown';
      console.log(`   Patient #${patientsCount}: ${name} (${userId})`);
      
      const hasCreatedAt = userData.createdAt !== undefined && userData.createdAt !== null;
      const hasUpdatedAt = userData.updatedAt !== undefined && userData.updatedAt !== null;
      
      if (hasCreatedAt && hasUpdatedAt) {
        console.log(`     ✅ Already has timestamps`);
        alreadyHaveTimestamps++;
        continue;
      }
      
      console.log(`     ⚠️ Missing: createdAt=${!hasCreatedAt}, updatedAt=${!hasUpdatedAt}`);
      
      try {
        const userRef = doc(db, 'Users', userId);
        const updates: any = {};
        
        if (!hasCreatedAt) {
          updates.createdAt = Timestamp.now();
          console.log(`        → Adding createdAt: ${new Date().toISOString()}`);
        }
        
        if (!hasUpdatedAt) {
          updates.updatedAt = Timestamp.now();
          console.log(`        → Adding updatedAt: ${new Date().toISOString()}`);
        }
        
        await updateDoc(userRef, updates);
        console.log(`     🟢 Fixed!\n`);
        fixedCount++;
      } catch (error) {
        console.error(`     ❌ Error fixing patient ${userId}:`, error);
      }
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`   Total patients processed: ${patientsCount}`);
    console.log(`   Already had timestamps: ${alreadyHaveTimestamps}`);
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`\n✅ Done!\n`);
    
    return {
      totalPatients: patientsCount,
      alreadyHadTimestamps: alreadyHaveTimestamps,
      fixed: fixedCount,
    };
    
  } catch (error) {
    console.error('❌ Error in fixPatientTimestamps:', error);
    throw error;
  }
};


export const inspectPatientTimestamps = async () => {
  console.log('\n🔍 INSPECTING PATIENT TIMESTAMPS...\n');
  
  try {
    const patientsRef = collection(db, 'Users');
    const snapshot = await getDocs(patientsRef);
    
    let patientCount = 0;
    
    for (const userDoc of snapshot.docs) {
      const userData = userDoc.data();
      
      if (userData.role !== 'patient') continue;
      
      patientCount++;
      const name = userData.displayName || 'Unknown';
      
      console.log(`Patient #${patientCount}: ${name}`);
      console.log(`  ID: ${userDoc.id}`);
      console.log(`  createdAt: ${userData.createdAt}`);
      console.log(`  updatedAt: ${userData.updatedAt}`);
      
      if (userData.createdAt?.toDate) {
        console.log(`    → Converted: ${userData.createdAt.toDate().toLocaleString()}`);
      }
      console.log();
    }
    
    console.log(`✅ Inspected ${patientCount} patients\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};
