-- Consultas para revisar la calidad y la normalización de los datos.
-- Ábrelas en DBeaver (Editor SQL) y ejecútalas una a una con Ctrl/Cmd + Enter.
-- Las marcadas "debe dar 0" indican un problema si devuelven filas.

-- 1. Cuántas filas hay en cada tabla
SELECT 'idiomas' AS tabla, count(*) FROM idiomas
UNION ALL SELECT 'paises', count(*) FROM paises
UNION ALL SELECT 'licencias', count(*) FROM licencias
UNION ALL SELECT 'fuentes', count(*) FROM fuentes
UNION ALL SELECT 'familias', count(*) FROM familias
UNION ALL SELECT 'generos', count(*) FROM generos
UNION ALL SELECT 'especies', count(*) FROM especies
UNION ALL SELECT 'especies_paises', count(*) FROM especies_paises
UNION ALL SELECT 'nombres_comunes', count(*) FROM nombres_comunes
UNION ALL SELECT 'estados_invasion', count(*) FROM estados_invasion
UNION ALL SELECT 'observaciones_cuidado', count(*) FROM observaciones_cuidado;

-- 2. nombre_normalizado de especies que no coincide con "género epíteto"   -- debe dar 0
SELECT e.id, g.nombre || ' ' || e.epiteto AS nombre, e.nombre_normalizado
FROM especies e JOIN generos g ON g.id = e.genero_id
WHERE e.nombre_normalizado <> lower(g.nombre || ' ' || e.epiteto);

-- 3. Nombres con espacios sobrantes, o con separadores sin dividir   -- debe dar 0
SELECT id, nombre FROM nombres_comunes
WHERE nombre <> btrim(nombre) OR nombre ~ '\s{2,}' OR nombre ~ '[|;]';

-- 4. nombre_normalizado de nombres comunes con mayúsculas o acentos   -- debe dar 0
SELECT id, nombre_normalizado FROM nombres_comunes
WHERE nombre_normalizado <> lower(nombre_normalizado) OR nombre_normalizado ~ '[áéíóúüñÁÉÍÓÚÜÑ]';

-- 5. Epítetos o géneros con espacios sobrantes o mayúscula incorrecta   -- debe dar 0
SELECT id, nombre FROM generos WHERE nombre <> btrim(nombre) OR nombre !~ '^[A-ZÁÉÍÓÚÑ]'
UNION ALL
SELECT id, epiteto FROM especies WHERE epiteto <> btrim(epiteto) OR epiteto ~ '^\s';

-- 6. Rangos de altitud invertidos   -- debe dar 0
SELECT especie_id, pais_codigo, altitud_min_m, altitud_max_m FROM especies_paises
WHERE altitud_min_m > altitud_max_m;

-- 7. Familias sin géneros, o géneros sin especies   -- debe dar 0
SELECT 'familia sin géneros' AS problema, f.nombre FROM familias f
LEFT JOIN generos g ON g.familia_id = f.id WHERE g.id IS NULL
UNION ALL
SELECT 'género sin especies', g.nombre FROM generos g
LEFT JOIN especies e ON e.genero_id = g.id WHERE e.id IS NULL;

-- 8. Especies sin país (todas deberían tener al menos una fila en especies_paises)   -- debe dar 0
SELECT e.id FROM especies e
LEFT JOIN especies_paises ep ON ep.especie_id = e.id WHERE ep.especie_id IS NULL;

-- 9. Géneros sin familia conocida (informativo)
SELECT count(*) AS generos_sin_familia FROM generos WHERE familia_id IS NULL;

-- 10. Especies por familia (las 15 más grandes)
SELECT f.nombre AS familia, count(*) AS especies
FROM especies e
JOIN generos g ON g.id = e.genero_id
JOIN familias f ON f.id = g.familia_id
GROUP BY 1 ORDER BY 2 DESC LIMIT 15;

-- 11. Nombres comunes por fuente y licencia
SELECT f.nombre AS fuente, f.licencia_codigo AS licencia, count(*) AS nombres
FROM nombres_comunes n JOIN fuentes f ON f.id = n.fuente_id
GROUP BY 1, 2 ORDER BY 3 DESC;

-- 12. Cuántos nombres tienen país conocido (informativo)
SELECT count(*) FILTER (WHERE pais_codigo IS NULL) AS sin_pais,
       count(*) FILTER (WHERE pais_codigo IS NOT NULL) AS con_pais
FROM nombres_comunes;

-- 13. Especies sin nombre común en español (informativo)
SELECT count(*) AS sin_nombre_comun
FROM especies e
WHERE NOT EXISTS (
  SELECT 1 FROM nombres_comunes n WHERE n.especie_id = e.id AND n.idioma_codigo = 'es'
);

-- 14. Una especie completa, con todo lo que se sabe de ella
SELECT f.nombre AS familia, g.nombre || ' ' || e.epiteto AS especie,
       ep.pais_codigo, ep.num_registros, ep.altitud_min_m, ep.altitud_max_m,
       string_agg(DISTINCT n.nombre, ', ') AS nombres
FROM especies e
JOIN generos g ON g.id = e.genero_id
LEFT JOIN familias f ON f.id = g.familia_id
LEFT JOIN especies_paises ep ON ep.especie_id = e.id
LEFT JOIN nombres_comunes n ON n.especie_id = e.id
WHERE g.nombre = 'Bursera' AND e.epiteto = 'simaruba'
GROUP BY 1, 2, 3, 4, 5, 6;

-- 15. Plantas por categoría en Colombia (informativo)
SELECT c.nombre AS categoria, count(*) AS especies
FROM especies_categorias ec
JOIN categorias c ON c.codigo = ec.categoria_codigo
JOIN especies_paises ep ON ep.especie_id = ec.especie_id AND ep.pais_codigo = 'CO'
GROUP BY 1 ORDER BY 2 DESC;

-- 16. Imágenes con licencia que no es CC0 ni CC-BY (debe dar 0 filas)
SELECT id, url, licencia_codigo FROM imagenes
WHERE licencia_codigo NOT IN ('CC0-1.0', 'CC-BY-4.0');

-- 17. Imágenes sin autoría o con enlace sin cifrar (debe dar 0 filas)
SELECT id, url FROM imagenes
WHERE btrim(autor) = '' OR url NOT LIKE 'https://%';

-- 18. Especies de las categorías sin ninguna imagen (informativo)
SELECT g.nombre || ' ' || e.epiteto AS especie
FROM especies_categorias ec
JOIN especies e ON e.id = ec.especie_id
JOIN generos g ON g.id = e.genero_id
WHERE NOT EXISTS (SELECT 1 FROM imagenes i WHERE i.especie_id = e.id)
GROUP BY 1 ORDER BY 1;

-- 19. Imágenes por especie: mínimo, máximo y promedio (informativo)
SELECT min(n), max(n), round(avg(n), 1) AS promedio
FROM (SELECT count(*) AS n FROM imagenes GROUP BY especie_id) t;
