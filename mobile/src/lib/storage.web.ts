// Web build: SecureStore isn't available in browsers, so the token goes in localStorage like the web app.
export async function getItem(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the session lasts until reload.
  }
}
