import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
];

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});

let isSigningIn = false;
let cachedIdToken: string | null = null;
let cachedGoogleAccessToken: string | null = null;

try {
  cachedGoogleAccessToken = sessionStorage.getItem('tvc_google_access_token');
} catch {
  // Session storage unavailable
}

export const initAuth = (
  onAuthSuccess?: (user: User, idToken: string, accessToken: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        const freshIdToken = await user.getIdToken();
        cachedIdToken = freshIdToken;
        if (!cachedGoogleAccessToken) {
          try {
            cachedGoogleAccessToken = sessionStorage.getItem('tvc_google_access_token');
          } catch {}
        }
        if (onAuthSuccess) {
          onAuthSuccess(user, freshIdToken, cachedGoogleAccessToken);
        }
      } catch (err) {
        console.warn('Failed to retrieve Firebase ID token:', err);
        cachedIdToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      if (!isSigningIn) {
        cachedIdToken = null;
        cachedGoogleAccessToken = null;
        try {
          sessionStorage.removeItem('tvc_google_access_token');
        } catch {}
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  idToken: string;
  accessToken: string | null;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const idToken = await result.user.getIdToken();
    cachedIdToken = idToken;
    cachedGoogleAccessToken = credential?.accessToken || null;
    if (cachedGoogleAccessToken) {
      try {
        sessionStorage.setItem('tvc_google_access_token', cachedGoogleAccessToken);
      } catch {}
    }
    return {
      user: result.user,
      idToken,
      accessToken: cachedGoogleAccessToken,
    };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      console.info('Google Sign-In popup closed by user.');
      return null;
    }
    if (error?.code === 'auth/popup-blocked') {
      console.warn('Google Sign-In popup was blocked by browser.');
      return null;
    }
    console.warn('Google Sign-In interrupted:', error?.message || error);
    return null;
  } finally {
    isSigningIn = false;
  }
};

export const getIdToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      cachedIdToken = await auth.currentUser.getIdToken();
    } catch {
      // fallback to cached
    }
  }
  return cachedIdToken;
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedGoogleAccessToken) {
    try {
      cachedGoogleAccessToken = sessionStorage.getItem('tvc_google_access_token');
    } catch {}
  }
  return cachedGoogleAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedIdToken = null;
  cachedGoogleAccessToken = null;
  try {
    sessionStorage.removeItem('tvc_google_access_token');
  } catch {}
};

export const verifyAuthPersistence = () => {
  console.log('--- Auth Persistence Diagnostics ---');
  
  // 1. Check Firebase Auth State
  console.log('Firebase Auth User:', auth.currentUser ? auth.currentUser.uid : 'No user logged in');
  
  // 2. Check Custom Session Token
  try {
    const customToken = localStorage.getItem('tvc_session_token');
    console.log('Custom Session Token present:', !!customToken);
  } catch (err) {
    console.error('Error checking localStorage for custom token:', err);
  }

  // 3. Check Google Access Token
  try {
    const googleToken = sessionStorage.getItem('tvc_google_access_token');
    console.log('Google Access Token present:', !!googleToken);
  } catch (err) {
    console.error('Error checking sessionStorage for Google token:', err);
  }

  console.log('------------------------------------');
};
