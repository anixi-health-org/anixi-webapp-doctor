

import { collection, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface PatientDebugInfo {
  id: string;
  name: string;
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
  createdAtValue?: any;
  updatedAtValue?: any;
}

export const patientDebugUtils = {

  inspectPatients: async (): Promise<PatientDebugInfo[]> => {
    console.log('\n🔍 INSPECTING PATIENT TIMESTAMPS\n');
    
    try {
      const usersRef = collection(db, 'Users');
      const allUsers = await getDocs(usersRef);
      
      const results: PatientDebugInfo[] = [];
      let patientCount = 0;
      
      for (const userDoc of allUsers.docs) {
        const userData = userDoc.data();
        
        if (userData.role !== 'patient') continue;
        
        patientCount++;
        const info: PatientDebugInfo = {
          id: userDoc.id,
          name: userData.displayName || 'Unknown',
          hasCreatedAt: userData.createdAt !== undefined && userData.createdAt !== null,
          hasUpdatedAt: userData.updatedAt !== undefined && userData.updatedAt !== null,
          createdAtValue: userData.createdAt,
          updatedAtValue: userData.updatedAt,
        };
        
        results.push(info);
        
        console.log(`${patientCount}. ${info.name}`);
        console.log(`   ID: ${info.id}`);
        console.log(`   createdAt: ${info.hasCreatedAt ? '✅ EXISTS' : '❌ MISSING'} ${info.createdAtValue?.toDate ? `(${info.createdAtValue.toDate().toLocaleDateString()})` : ''}`);
        console.log(`   updatedAt: ${info.hasUpdatedAt ? '✅ EXISTS' : '❌ MISSING'} ${info.updatedAtValue?.toDate ? `(${info.updatedAtValue.toDate().toLocaleDateString()})` : ''}`);
        console.log();
      }
      
      console.log(`\n📊 TOTAL: ${patientCount} patients`);
      console.log(`✅ Data collected and returned\n`);
      
      return results;
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  },

  
  fixPatients: async (): Promise<{ fixed: number; total: number; patients: string[] }> => {
    console.log('\n🔧 FIXING PATIENT TIMESTAMPS\n');
    
    try {
      const usersRef = collection(db, 'Users');
      const allUsers = await getDocs(usersRef);
      
      let patientCount = 0;
      let fixedCount = 0;
      const fixedPatients: string[] = [];
      const now = Timestamp.now();
      
      for (const userDoc of allUsers.docs) {
        const userData = userDoc.data();
        
        if (userData.role !== 'patient') continue;
        
        patientCount++;
        const name = userData.displayName || 'Unknown';
        
        const hasCreatedAt = userData.createdAt !== undefined && userData.createdAt !== null;
        const hasUpdatedAt = userData.updatedAt !== undefined && userData.updatedAt !== null;
        
        if (hasCreatedAt && hasUpdatedAt) {
          console.log(`✅ ${patientCount}. ${name} - Already has timestamps`);
          continue;
        }
        
        console.log(`⚠️  ${patientCount}. ${name} - Fixing...`);
        
        try {
          const userRef = doc(db, 'Users', userDoc.id);
          const updates: any = {};
          
          if (!hasCreatedAt) {
            updates.createdAt = now;
            console.log(`    ✓ Added createdAt`);
          }
          
          if (!hasUpdatedAt) {
            updates.updatedAt = now;
            console.log(`    ✓ Added updatedAt`);
          }
          
          await updateDoc(userRef, updates);
          fixedCount++;
          fixedPatients.push(name);
          console.log(`    🟢 Fixed!\n`);
        } catch (error: any) {
          console.error(`    ❌ Error: ${error.message}\n`);
        }
      }
      
      console.log(`\n📊 SUMMARY:`);
      console.log(`   Total patients: ${patientCount}`);
      console.log(`   Fixed: ${fixedCount}`);
      
      if (fixedCount > 0) {
        console.log(`\n✅ Done! Patients fixed:`);
        fixedPatients.forEach((name, i) => console.log(`   ${i + 1}. ${name}`));
        console.log(`\n💡 Refresh the page (F5) to see the changes`);
      } else {
        console.log(`✅ All patients already have proper timestamps!`);
      }
      console.log();
      
      return { fixed: fixedCount, total: patientCount, patients: fixedPatients };
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      throw error;
    }
  },

  
  help: () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   🩺 ANIXI DEBUG UTILITIES - Patient Timestamps            ║
╚════════════════════════════════════════════════════════════╝

Available commands:

1. INSPECT patient timestamps:
   await window.__anixi_debug.inspectPatients()
   
   Shows: All patients and their timestamp status
   Returns: Array of patient info

2. FIX missing timestamps:
   await window.__anixi_debug.fixPatients()
   
   Shows: Progress and summary
   Returns: { fixed, total, patients }

3. Show this help:
   window.__anixi_debug.help()

EXAMPLE WORKFLOW:
─────────────────

// Step 1: Check what needs fixing
const info = await window.__anixi_debug.inspectPatients();

// Step 2: Fix any missing timestamps
const result = await window.__anixi_debug.fixPatients();

// Step 3: Verify the fix
await window.__anixi_debug.inspectPatients();

// Step 4: Refresh the page
window.location.reload();

═════════════════════════════════════════════════════════════
    `);
  },
};

declare global {
  interface Window {
    __anixi_debug: typeof patientDebugUtils;
  }
}

if (typeof window !== 'undefined') {
  window.__anixi_debug = patientDebugUtils;
  console.log('🩺 Anixi Debug Utils Available: window.__anixi_debug');
  console.log('   Type: window.__anixi_debug.help() for commands');
}

export default patientDebugUtils;
