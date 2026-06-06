-- ============================================================================
-- Migración: quitar guiones de los IDs de folders (nuevo esquema de direcciones)
-- ============================================================================
-- El nuevo slug de carpeta solo admite [a-z0-9] (sin guiones), porque el guión
-- es el separador del subdominio: drive-{crono}-folder-folder.com.blog
--
-- Transformación:
--   new_id = quitar de `id` todo lo que no sea [a-z0-9/]  (conserva "/", quita "-")
--   ej: "juridico/no-1-estudio-de-impacto-ambiental-nvbola"
--     → "juridico/no1estudiodeimpactoambientalnvbola"
--
-- Actualiza:
--   folders.id, folders.parent_id, folders.name
--   files.core_folder_id
--   folder_shares.folder_id
--
-- NO toca files.azure_blob_path (apunta al blob físico; renombrar el registro
-- no mueve el blob — la descarga usa azure_blob_path directo, sigue funcionando).
--
-- IMPORTANTE: corre PRIMERO el paso 1 (colisiones). Si devuelve filas, dos
-- carpetas distintas quedarían con el mismo id → resuélvelo manualmente antes.
-- Haz BACKUP de la BD antes de correr el paso 2.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — VERIFICACIÓN DE COLISIONES (ejecutar y revisar; no modifica nada)
-- ----------------------------------------------------------------------------
-- Si devuelve 0 filas → seguro continuar con el paso 2.
-- Si devuelve filas → esos folders colisionan; renómbralos/elimínalos antes.
SELECT regexp_replace(id, '[^a-z0-9/]', '', 'g') AS new_id,
       count(*)              AS cuantos,
       array_agg(id)         AS ids_originales
FROM   folders
GROUP  BY 1
HAVING count(*) > 1;


-- ----------------------------------------------------------------------------
-- PASO 2 — MIGRACIÓN (transacción atómica: o todo o nada)
-- ----------------------------------------------------------------------------
BEGIN;

-- Quitamos el FK self-referencial para poder reescribir id y parent_id sin
-- violaciones intermedias.
ALTER TABLE folders DROP CONSTRAINT IF EXISTS "FK_folders_folders_parent_id";

-- 2.1 Archivos: core_folder_id apunta al id del folder
UPDATE files
   SET core_folder_id = regexp_replace(core_folder_id, '[^a-z0-9/]', '', 'g')
 WHERE core_folder_id ~ '[^a-z0-9/]';

-- 2.2 Shares: folder_id apunta al id del folder
UPDATE folder_shares
   SET folder_id = regexp_replace(folder_id, '[^a-z0-9/]', '', 'g')
 WHERE folder_id ~ '[^a-z0-9/]';

-- 2.3 Folders: primero parent_id, luego id + name (el FK está fuera, no importa
--     el orden; ambos usan la misma transformación → quedan consistentes).
UPDATE folders
   SET parent_id = regexp_replace(parent_id, '[^a-z0-9/]', '', 'g')
 WHERE parent_id IS NOT NULL AND parent_id ~ '[^a-z0-9/]';

UPDATE folders
   SET id   = regexp_replace(id,   '[^a-z0-9/]', '', 'g'),
       name = regexp_replace(name, '[^a-z0-9]',  '', 'g')
 WHERE id ~ '[^a-z0-9/]' OR name ~ '[^a-z0-9]';

-- Recreamos el FK igual que en la migración EF (ON DELETE RESTRICT)
ALTER TABLE folders
  ADD CONSTRAINT "FK_folders_folders_parent_id"
  FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE RESTRICT;

COMMIT;


-- ----------------------------------------------------------------------------
-- PASO 3 — VERIFICACIÓN POST-MIGRACIÓN (debe devolver 0 filas en cada query)
-- ----------------------------------------------------------------------------
-- Folders con guiones aún en id o name:
SELECT id, name FROM folders WHERE id ~ '[^a-z0-9/]' OR name ~ '[^a-z0-9]';

-- Archivos cuyo core_folder_id no corresponde a ningún folder (huérfanos):
SELECT f.id, f.core_folder_id
FROM   files f
LEFT   JOIN folders d ON d.id = f.core_folder_id
WHERE  d.id IS NULL AND f.core_folder_id ~ '[^a-z0-9/]';
