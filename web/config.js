// Config pública del front. La URL del proyecto, la anon key y la Site Key de Turnstile son
// públicas por diseño: con la anon key no se puede leer ni escribir nada (ver DEPLOY.md).
// En localhost se usa el proyecto de prueba (sin CAPTCHA); en cualquier otro dominio, el real.
window.MAGNATE_CONFIG = (() => {
  const PROD = {
    supabaseUrl: 'https://ayyfmyixljjtxkfvyhsz.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5eWZteWl4bGpqdHhrZnZ5aHN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNDczNDYsImV4cCI6MjEwNTkyMzM0Nn0.xMUmJjCvr9myT5mXxQRpfgtB-7iIqZrzRD9WhRt6hB0',
    turnstileSiteKey: '0x4AAAAAAFOmxPmzfU0WEKdm',
  };
  const DEV = {
    supabaseUrl: 'https://esluocwhxooyuwcyfntd.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbHVvY3doeG9veXV3Y3lmbnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDQwMjgsImV4cCI6MjEwNjE4MDAyOH0.zD_EJW6Cc8guUtj1bAZjGBwZ5K6GBhaA3-illFVj2Wk',
    turnstileSiteKey: null,
  };
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' ? DEV : PROD;
})();
