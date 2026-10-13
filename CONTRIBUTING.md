# Cómo contribuir

¡Gracias por querer ayudar! Puedes aportar de varias maneras:

- **Código:** API, base de datos, importadores, pruebas, documentación.
- **Datos de cuidado:** experiencias reales con una planta, con lugar, altitud,
  condiciones y resultado.
- **Revisión científica:** validar datos si tienes formación en botánica o agronomía.
- **Traducción y nombres comunes:** nombres locales por país y región.

## Reglas básicas

1. Lee [CONTENT_POLICY.md](CONTENT_POLICY.md). **No se aceptan usos medicinales ni rituales.**
2. Cita la fuente de todo dato que no sea tu propia observación.
3. No subas datos con licencia que restrinja el uso comercial (por ejemplo, CC-BY-NC).
4. No subas fotos de las que no seas autor o que no tengan una licencia abierta compatible.

## Licencia de tus aportes

Al contribuir aceptas que:

- Tu **código** se publica bajo AGPL-3.0.
- Tus **datos** se publican bajo ODbL 1.0, y tus **textos y fotos** bajo CC-BY-SA 4.0.
- Tienes derecho a aportarlo.

Usamos el **Developer Certificate of Origin (DCO)**: firma tus commits con
`git commit -s` para certificar que puedes aportar ese contenido. No se exige cesión
de derechos, así que tú conservas la autoría de lo que aportas.

## Entorno de desarrollo

Este proyecto usa **solo pnpm**. Ver el README para instalar y arrancar.

Si cambias el esquema de la base de datos o la API, ejecuta `pnpm docs:generate` y
sube también los documentos generados. La CI lo verifica con `pnpm docs:check`.

## Flujo

1. Abre un *issue* para discutir cambios grandes.
2. Haz un *fork* y crea una rama.
3. Envía un *pull request* con una descripción clara.
