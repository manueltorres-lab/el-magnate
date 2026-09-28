# Cómo se sube El Magnate a Supabase

Primero a un proyecto de **prueba** ("el-magnate-dev"). Recién cuando todo ande ahí, y con
tu OK, al proyecto real (`ayyfmyixljjtxkfvyhsz`).

## 1. Lo que hacés vos en supabase.com (una sola vez)

1. **Crear el proyecto de prueba.** En supabase.com → *New project*. Nombre:
   `el-magnate-dev`. Región: **South America (São Paulo)**. La contraseña de la base
   guardala en tu gestor de contraseñas; no me la pases.
2. **Usuarios anónimos.** En ese proyecto: *Authentication → Sign In / Providers* →
   activar **Allow anonymous sign-ins**. (El CAPTCHA con Turnstile en el de prueba es
   opcional; en el real, sí.)
3. **Apagar la Data API.** *Project Settings → Data API* → desactivarla. El juego no la
   usa: todo pasa por la función `api`.
4. **Un token para que yo pueda trabajar.** *Account (tu avatar) → Access Tokens* →
   *Generate new token*, con el nombre `claude-el-magnate`. **No lo pegues en el chat.**
   Cargalo en la configuración del entorno de esta sesión de Claude (menú del entorno en
   la barra de título → *Edit*) como variable de entorno:
   `SUPABASE_ACCESS_TOKEN=<el token>`.
5. **Dejarme salir a Supabase.** En esa misma pantalla, en *Network access*, agregar
   estos dominios permitidos: `api.supabase.com`, `*.supabase.co`, `*.supabase.com`.

El token se puede borrar desde supabase.com cuando terminemos.

## 2. Lo que hago yo (con el token y la red habilitados)

```sh
npx supabase link --project-ref <ref de el-magnate-dev>
npx supabase db push                       # aplica supabase/migrations
# SERVER_SECRET: 32 bytes al azar, generados y cargados sin mostrarse nunca
npx supabase secrets set SERVER_SECRET="$(openssl rand -base64 48)" >/dev/null
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:5173,<dominio del juego>"
npm run sync:engine
npx supabase functions deploy api
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> npm run check:anon
```

`check:anon` intenta leer y escribir cada tabla con la clave pública (y con un usuario
anónimo logueado): tiene que fallar todo. Después juego una partida completa contra la
API desplegada.

Notas:

- `SERVER_SECRET` nunca se escribe en archivos ni en pantalla. **Si se rota, las
  partidas en curso quedan inválidas** (las semillas ya calculadas siguen guardadas,
  pero un duelo nuevo con el mismo código daría otra partida).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL` las inyecta Supabase
  en la función; no hay que cargarlas.
- `GAME_CONFIG` (opcional): JSON con `rounds`, `startingCapital`, `eventChance`,
  `incomeBase`, `minigame`. Si no está, se usan los valores del motor.
- El front solo necesita la URL del proyecto y la **anon key** (son públicas).

## 3. Al proyecto real

Los mismos pasos del punto 2 con `--project-ref ayyfmyixljjtxkfvyhsz`, **después de que
lo confirmes**, y con el dominio final del juego en `ALLOWED_ORIGINS`.
