import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Use a getter to ensure auth is accessed only after registration
let authInstance: ReturnType<typeof getAuth> | null = null;
export const getAuthInstance = () => {
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  return authInstance;
};

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = () => signInWithPopup(getAuthInstance(), googleProvider);
export const logout = () => signOut(getAuthInstance());
export const onAuthChange = (callback: (user: User | null) => void) => onAuthStateChanged(getAuthInstance(), callback);
export type { User };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const auth = getAuthInstance();
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function saveScreeningToFirebase(patientData: any, screeningResult: any) {
  const path = 'screenings';
  try {
    await addDoc(collection(db, path), {
      ...patientData,
      ...screeningResult,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getScreeningsFromFirebase() {
  const path = 'screenings';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamp to string for UI consistency
      timestamp: doc.data().timestamp?.toDate().toLocaleString('id-ID') || new Date().toLocaleString('id-ID'),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
