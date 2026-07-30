import {
  collection,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { USERS_COLLECTION } from '../shared/constants';
import { Patient } from '../types';


export const generatePatientAdherenceData = async (
  patient: Patient,
  daysBack: number = 30
) => {
  try {
    const medications = patient.currentTreatments || [];

    if (medications.length === 0) {
      return;
    }

    const batch = writeBatch(db);
    let count = 0;

    for (let i = daysBack; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // eslint-disable-next-line no-loop-func
      medications.forEach((med) => {
        const timeSlots = [
          { slot: 'morning', hour: 8 },
          { slot: 'afternoon', hour: 14 },
          { slot: 'evening', hour: 20 },
        ];

        timeSlots.forEach(({ slot, hour }) => {
          const scheduledTime = new Date(date);
          scheduledTime.setHours(hour, 0, 0, 0);

          const random = Math.random();
          let status: 'taken' | 'missed' | 'pending' = 'pending';

          if (random > 0.1) {
            status = 'taken';
          } else if (random > 0.05) {
            status = 'missed';
          }

          const adherenceRef = doc(
            db,
            USERS_COLLECTION,
            patient.id,
            'adherence_records',
            `${dateStr}_${med.name}_${slot}`
          );

          batch.set(adherenceRef, {
            medicationName: med.name,
            dosage: med.dosage,
            scheduledTime: scheduledTime,
            status: status,
            timeSlot: slot,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          count++;
        });
      });
    }

    await batch.commit();
    return count;
  } catch (error) {
    ;
    throw error;
  }
};


export const generatePatientMoodData = async (
  patient: Patient,
  daysBack: number = 30
) => {
  try {

    const batch = writeBatch(db);
    let count = 0;

    const moods = ['happy', 'neutral', 'sad', 'anxious', 'tired', 'frustrated'];
    const moodWeights = [0.4, 0.3, 0.1, 0.1, 0.05, 0.05]; 

    for (let i = daysBack; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const entriesPerDay = Math.random() > 0.5 ? 2 : 1;

      for (let j = 0; j < entriesPerDay; j++) {
        const hour = Math.floor(Math.random() * 16) + 6; 
        const minute = Math.floor(Math.random() * 60);
        const createdAt = new Date(date);
        createdAt.setHours(hour, minute, 0, 0);

        const random = Math.random();
        let cumulativeWeight = 0;
        let selectedMood = moods[0];
        for (let k = 0; k < moods.length; k++) {
          cumulativeWeight += moodWeights[k];
          if (random <= cumulativeWeight) {
            selectedMood = moods[k];
            break;
          }
        }

        const notes = Math.random() > 0.3 ? generateMoodNote(selectedMood) : '';

        const moodRef = doc(
          collection(db, USERS_COLLECTION, patient.id, 'mood_entries')
        );

        batch.set(moodRef, {
          mood: selectedMood,
          notes: notes,
          createdAt: createdAt,
          date: date.toISOString().split('T')[0],
        });

        count++;
      }
    }

    await batch.commit();
    return count;
  } catch (error) {
    ;
    throw error;
  }
};


const generateMoodNote = (mood: string): string => {
  const notes = {
    happy: ['Feeling great today!', 'Had a productive day', 'Everything is going well'],
    neutral: ['Just another day', 'Feeling okay', 'Nothing special today'],
    sad: ['Feeling a bit down', 'Had a rough day', 'Need some cheering up'],
    anxious: ['Feeling worried about upcoming appointment', 'A bit stressed today', 'Need to relax'],
    tired: ['Didn\'t sleep well last night', 'Feeling exhausted', 'Need more rest'],
    frustrated: ['Things aren\'t going my way', 'Feeling irritated', 'Need to calm down'],
  };

  const moodNotes = notes[mood as keyof typeof notes] || [''];
  return moodNotes[Math.floor(Math.random() * moodNotes.length)];
};


export const generateAdherenceDataForPatients = async (
  patients: Patient[],
  daysBack: number = 30
) => {

  let totalAdherenceRecords = 0;
  let totalMoodRecords = 0;

  for (const patient of patients) {
    try {
      const adherenceCount = await generatePatientAdherenceData(patient, daysBack);
      if (adherenceCount) totalAdherenceRecords += adherenceCount;

      const moodCount = await generatePatientMoodData(patient, daysBack);
      if (moodCount) totalMoodRecords += moodCount;
    } catch (error) {
      ;
    }
  }

  return { adherenceRecords: totalAdherenceRecords, moodRecords: totalMoodRecords };
};
